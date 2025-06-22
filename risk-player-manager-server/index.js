const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/seen', (req, res) => {
    const { name, deviceId, userId } = req.query;

    if (!name || !deviceId || !userId) {
        return res.status(400).send('Missing parameters');
    }

    if (getIgnoredPlayerIds().includes(userId)) {
        return res.status(200).send('OK');
    }

    if (db.inCurrentLobby(deviceId, userId)) {
        return res.status(200).send('OK');
    }

    db.playerSeen(name, deviceId, userId);
    db.addToCurrentLobby(name, deviceId, userId);
    linkWithKnown(deviceId, userId, true);

    return res.status(200).send('OK');
});

app.get('/resetLobby', (req, res) => {
    db.resetCurrentLobby();
    return res.status(200).send('OK');
});

app.get('/lobby-remove', (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).send('Missing parameters');
    }

    db.removeFromLobby(userId);
    return res.status(200).send('OK');
});

app.get('/whitelist', (req, res) => {
    const { name, deviceId, userId } = req.query;

    if (!name || !deviceId || !userId) {
        return res.status(400).send('Missing parameters');
    }

    db.whiteListPlayer(name, deviceId, userId);
    return res.status(200).send('OK');
});

app.get('/whitelist-remove', (req, res) => {
    const { deviceId, userId } = req.query;

    if (!deviceId || !userId) {
        return res.status(400).send('Missing parameters');
    }

    db.removeFromWhiteList(deviceId, userId);
    return res.status(200).send('OK');
});

app.get('/blacklist', (req, res) => {
    const { name, deviceId, userId } = req.query;

    if (!name || !deviceId || !userId) {
        return res.status(400).send('Missing parameters');
    }

    db.blacklistPlayer(name, deviceId, userId);
    return res.status(200).send('OK');
});

app.get('/blacklist-remove', (req, res) => {
    const { deviceId, userId } = req.query;

    if (!deviceId || !userId) {
        return res.status(400).send('Missing parameters');
    }

    db.removeFromBlacklist(deviceId, userId);
    return res.status(200).send('OK');
});


app.get('/lobby', (req, res) => {
    const lobby = db.getCurrentLobby().map(player => {
        player.whitelistedAt = db.whitelistedAt(player.deviceId, player.userId);
        player.blacklistedAt = db.blacklistedAt(player.deviceId, player.userId);

        if (!!player.blacklistedAt) {
            player.status = 'blacklisted';
        } else if (!!player.whitelistedAt) {
            player.status = 'whitelisted';
        } else {
            player.status = 'neutral';
        }

        let seen = db.getSeenWithLinked(player.deviceId, player.deviceId).map(seenPlayer => {
            seenPlayer.nameChanged = player.name !== seenPlayer.name;
            seenPlayer.deviceIdChanged = player.deviceId !== seenPlayer.deviceId;
            seenPlayer.userIdChanged = player.userId !== seenPlayer.userId;

            return seenPlayer;
        });

        seen.shift();

        player.seen = seen;
        return player;
    });

    res.json(lobby);
});

function linkWithKnown(deviceId1, userId1, recurse) {
    let queries = 1;

    let seenDeviceIds = [];
    let seenUserIds = [];

    db.getSeen(deviceId1, userId1).forEach(seenPlayer => {
        if (!seenDeviceIds.includes(seenPlayer.deviceId)) {
            seenDeviceIds.push(seenPlayer.deviceId);
        }

        if (!seenUserIds.includes(seenPlayer.userId)) {
            seenUserIds.push(seenPlayer.userId);
        }
    })

    let linkedDeviceIds = [];
    let linkedUserIds = [];

    seenDeviceIds.forEach(deviceId => {
        linkedDeviceIds.push(deviceId);
    })

    seenUserIds.forEach((userId) => {
        linkedUserIds.push(userId);
    })

    seenDeviceIds.forEach(deviceId => {
        queries++;
        db.getSeenByDeviceId(deviceId).forEach(seenPlayer => {
            linkedDeviceIds.push(seenPlayer.deviceId);
        })
    })

    seenUserIds.forEach(userId => {
        queries++;
        db.getSeenByUserId(userId).forEach(seenPlayer => {
            linkedUserIds.push(seenPlayer.userId);
        })
    })

    Array.from(new Set(linkedDeviceIds)).forEach((deviceId2) => {
        if (deviceId1 !== deviceId2) {
            db.linkDevices(deviceId1, deviceId2);
            queries++;

            if (recurse) {
                linkWithKnown(deviceId2, userId1, false);
            }
        }
    })

    Array.from(new Set(linkedUserIds)).forEach((userId2) => {
        if (userId1 !== userId2) {
            db.linkUsers(userId1, userId2);
            queries++;

            if (recurse) {
                linkWithKnown(deviceId1, userId2, false);
            }
        }
    })
}

function getIgnoredPlayerIds() {
    let path = 'my-user-ids.txt';

    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, '', 'utf8');
    }

    return fs.readFileSync(path, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

app.listen(PORT, () => {
    console.log(`Risk Player Manager Server running - http://localhost:${PORT}`);
});