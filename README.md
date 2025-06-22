### Prerequisites
- .NET 9.0 SDK
- node.js 22.15
- npm 10.9

### Building Agent:

#### Steps:
- `cd ./RiskPlayerManagerAgent/RiskPlayerManagerAgent`
- `dotnet add package Microsoft.Diagnostics.Runtime`
- `dotnet add package SharpPcap`
- `dotnet add package PacketDotNet`
- `dotnet publish`

#### Once built:
- Navigate to `./RiskPlayerManagerAgent/RiskPlayerManagerAgent/bin/Release/net-9.0`
- `RiskPlayerManagerAgent.exe` will be right there. Run as admin and the agent should start.

### Running Server

#### Steps:
- `cd ./risk-player-manager-server`
- `node index.js`
- Open http://localhost:3000/ in your browser