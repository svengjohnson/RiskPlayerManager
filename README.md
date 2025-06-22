### What it does:
When a new player joins your RISK Game Lobby, it's username, device ID, and user ID will be listed within the manager.
That lets you mark players as desirable, undesirable, and see all the previous times the player has joined your lobby. It also detects alt accounts from people you've played with, as it also matches on deviceID.

#### A quick demo - ignore the API calls made from Postman, they are done by the Agent:
https://github.com/user-attachments/assets/94805d65-276d-4f05-92f2-e1b9ee5a013c

### How it works:
It comes in 2 parts - Agent and Server. Agent analyzes RISK network traffic, and Server shows a nice frontend for it all.

It's purely network-traffic based - the game memory is not being touched at all!

#### What the Agent does:
- Finds the currently used UDP ports listened on by RISK.exe
- Captures those UDP packets destined for RISK
- Attempts to parse them to see whether they are "Player joined the lobby" packet
- - If parsed successfully - an API call is made to the Server informing it about the player that has joined the lobby
- Quitting/creating/joining a lobby causes the UDP ports risk is listening on to change
- - This event is treated as a lobby-change event, and they make a resetLobby API call to the Server, which will clear the current player list.

#### What the Server does:
- Accepts API calls from the Agent
- Serves a frontend for the Player Manager on http://localhost:3000/

## Building & Running

For this to work, both the Agent and the Server need to be running, and getting that done is trivial.

### Prerequisites
- .NET 9.0 SDK
- node.js 22
- npm 10

### Building & Running Agent:

#### Steps:
- `cd ./RiskPlayerManagerAgent/RiskPlayerManagerAgent`
- `dotnet add package Microsoft.Diagnostics.Runtime`
- `dotnet add package SharpPcap`
- `dotnet add package PacketDotNet`
- `dotnet publish`

#### Once Built:
- Navigate to `./RiskPlayerManagerAgent/RiskPlayerManagerAgent/bin/Release/net-9.0`
- `RiskPlayerManagerAgent.exe` will be right there. (Need to run as Administrator or it most likely won't work)

  
### Running Server

#### Steps:
- `cd ./risk-player-manager-server`
- `npm install`
- `node index.js`
- Open http://localhost:3000/ in your browser
