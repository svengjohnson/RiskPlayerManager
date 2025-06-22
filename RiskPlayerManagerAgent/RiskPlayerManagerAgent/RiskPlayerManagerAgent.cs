using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using PacketDotNet;
using SharpPcap;

class RiskPlayerManagerAgent
{
    static HashSet<int> _targetUdpPorts = new();
    private static int _lastUpdateTime;

    static void Main()
    {
        var devices = CaptureDeviceList.Instance;

        if (devices.Count < 1)
        {
            Console.WriteLine("No network adapters found.");
            return;
        }
        
        foreach (var liveDevice in devices)
        {
            liveDevice.OnPacketArrival += OnPacketArrival;

            liveDevice.Open(DeviceModes.Promiscuous, 2000);
            liveDevice.Filter = "udp";

            liveDevice.StartCapture();
        }

        Console.WriteLine("Risk Player Manager Agent is running. Press enter to exit.");
        Console.ReadLine();

        foreach (var liveDevice in devices)
        {
            liveDevice.StopCapture();
            liveDevice.Close();
        }
    }
    
    static HashSet<int> GetTargetPorts()
    {
        TimeSpan t = DateTime.UtcNow - new DateTime(1970, 1, 1);
        int currentEpoch = (int)t.TotalSeconds;

        if (_lastUpdateTime + 1 > currentEpoch)
        {
            return _targetUdpPorts;
        }
        
        var riskPids = Process.GetProcessesByName("RISK").Select(p => p.Id).ToList();
        
        if (riskPids.Count == 0)
        {
            return _targetUdpPorts;
        }

        var newPorts = new HashSet<int>();

        foreach (var pid in riskPids)
        {
            var ports = GetUdpPortsByPid(pid);
            foreach (var p in ports)
                newPorts.Add(p);
        }

        lock (_targetUdpPorts)
        {
            if (!_targetUdpPorts.SetEquals(newPorts))
            {
                if (_targetUdpPorts.Count > 0)
                {
                    ResetLobby();
                    Console.WriteLine("---------- Lobby Closed or Created ----------");
                }

                _targetUdpPorts = newPorts;
            }
        }

        _lastUpdateTime = currentEpoch;
        return _targetUdpPorts;
    }

    static void OnPacketArrival(object sender, PacketCapture e)
    {
        var rawCapture = e.GetPacket();
        var linkLayerType = rawCapture.LinkLayerType;
        var rawData = rawCapture.Data;

        Task.Run(() =>
        {
            var packet = Packet.ParsePacket(linkLayerType, rawData);
            var udp = packet.Extract<UdpPacket>();

            if (udp == null)
            {
                return;
            }

            int destPort = udp.DestinationPort;
            int payloadLength = udp.PayloadData?.Length ?? 0;
    
            if (!GetTargetPorts().Contains(destPort))
            {
                return;
            }

            if (payloadLength < 550 || payloadLength > 850)
            {
                return;
            }
    
            if (udp.PayloadData != null)
            {
                ParsePacket(udp.PayloadData);
            }
        });
    }
    
    static List<int> GetUdpPortsByPid(int pid)
    {
        var ports = new List<int>();

        var psi = new ProcessStartInfo
        {
            FileName = "netstat",
            Arguments = "-ano -p udp",
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        var process = Process.Start(psi);
        if (process == null)
        {
            return ports;
        }
        
        string output = process.StandardOutput.ReadToEnd();
        process.WaitForExit();

        var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            if (!line.TrimStart().StartsWith("UDP", StringComparison.OrdinalIgnoreCase))
                continue;

            var tokens = Regex.Split(line.Trim(), @"\s+");
            if (tokens.Length < 4)
                continue;

            string localAddress = tokens[1];
            string pidStr = tokens[^1];

            if (!int.TryParse(pidStr, out int foundPid) || foundPid != pid)
                continue;

            string portStr = localAddress.Split(':').Last();

            if (int.TryParse(portStr, out int port))
            {
                ports.Add(port);
            }
        }

        return ports.Distinct().ToList();
    }
    
    static void ParsePacket(byte[] data)
    {
        var textData = Encoding.ASCII.GetString(data);
        
        string ExtractString(string key)
        {
            int idx = textData.IndexOf(key, StringComparison.OrdinalIgnoreCase);
            if (idx < 0)
            {
                return "";
            }
            
            int rawIdx = FindBytes(data, Encoding.ASCII.GetBytes(key));
            if (rawIdx < 0)
            {
                return "";
            }

            int pos = rawIdx + key.Length;

            int len;
            if (pos + 1 < data.Length && data[pos] == 0)
            {
                len = data[pos + 1];
                pos += 2;
            }
            else if (pos + 2 < data.Length)
            {
                len = BitConverter.ToUInt16(data, pos);
                pos += 2;
            }
            else return "";

            if (pos + len > data.Length)
            {
                return "";
            }

            return Encoding.UTF8.GetString(data, pos, len);
        }
        
        long ExtractLong(string key)
        {
            int rawIdx = FindBytes(data, Encoding.ASCII.GetBytes(key));
            int pos = rawIdx + key.Length;
            
            byte[] bytes = new byte[8];
            Array.Copy(data, pos + 1, bytes, 0, 8);
            Array.Reverse(bytes);
            
            return BitConverter.ToInt64(bytes, 0);
        }

        int FindBytes(byte[] haystack, byte[] needle)
        {
            for (int i = 0; i < haystack.Length - needle.Length; i++)
            {
                bool found = true;
                for (int j = 0; j < needle.Length; j++)
                {
                    if (haystack[i + j] != needle[j])
                    {
                        found = false;
                        break;
                    }
                }
                if (found) return i;
            }
            return -1;
        }

        String name = ExtractString("names");
        String country = ExtractString("countrys");
        String deviceId = ExtractString("deviceIds");

        if (name.Length > 0 && country.Length > 0 && deviceId.Length > 0)
        {
            String userId = ExtractLong("userId").ToString();
            
            SeenPlayer(name, deviceId, userId);

            Console.WriteLine();
            Console.WriteLine("---------- Player Joined the Lobby ----------");
            Console.WriteLine($"Name:        {name}");
            Console.WriteLine($"Country:     {country}");
            Console.WriteLine($"DeviceId:    {deviceId}");
            Console.WriteLine($"UserId:      {userId}"); 
            Console.WriteLine("---------------------------------------------");
            Console.WriteLine();
        }
    }

    private static void SeenPlayer(String name, String deviceId, String userId)
    {
        string url = $"http://localhost:3000/seen?name={Uri.EscapeDataString(name)}&deviceId={Uri.EscapeDataString(deviceId)}&userId={Uri.EscapeDataString(userId)}";
        
        Task.Run(() =>
        {
            try
            {
                using (HttpClient client = new HttpClient())
                {
                    client.GetAsync(url).GetAwaiter().GetResult();
                }
            }
            catch
            {
                // don't care
            }
        });
    }

    private static void ResetLobby()
    {
        string url = "http://localhost:3000/resetLobby";
        
        Task.Run(() =>
        {
            try
            {
                using (HttpClient client = new HttpClient())
                {
                    client.GetAsync(url).GetAwaiter().GetResult();
                }
            }
            catch
            {
                // don't care
            }
        });
    }
}
