const openSeen = {};

function timeAgo(datetime) {
    if (!datetime) {
        return datetime;
    }

    const then = new Date(datetime.replace(' ', 'T') + 'Z');
    const now = new Date();

    const seconds = Math.floor((now - then) / 1000);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
        }
    }
    return 'just now';
}

function copyToClipboard(deviceId, index) {
    if (!navigator.clipboard) {
        alert('Clipboard API not supported');
        return;
    }

    navigator.clipboard.writeText(deviceId).then(() => {
        const feedback = document.getElementById(`copy-feedback-${index}`);
        if (feedback) {
            feedback.style.display = 'inline';
            setTimeout(() => {
                feedback.style.display = 'none';
            }, 1500);
        }
    }).catch(() => {
        alert('Failed to copy device ID');
    });
}

async function fetchLobby() {
    const res = await fetch('/lobby');
    const data = await res.json();

    const tbody = document.querySelector('#lobbyTable tbody');
    tbody.innerHTML = '';

    data.forEach((player, index) => {
        openSeen[index] = openSeen[index] !== undefined ? openSeen[index] : false;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class=${player.status}><strong>${player.name}</strong></td>
            <td class=${player.status}>
              <button id="copy-device-btn-${index}" onclick="copyToClipboard('${player.deviceId}', ${index})">Copy</button>
            </td>
            <td class=${player.status}>
              <button id="copy-device-btn-${index}" onclick="copyToClipboard('${player.userId}', ${index})">Copy</button>
            </td>
            <td class=${player.status}>
                ${!!player.whitelistedAt
            ? `<button class="red" onclick="act('whitelist-remove', JSON.parse(decodeURIComponent('${encodePlayer(player)}')))">${timeAgo(player.whitelistedAt)}</button>`
            : `<button class="green" onclick="act('whitelist', JSON.parse(decodeURIComponent('${encodePlayer(player)}')))">Add</button>`}
            </td>
            <td class=${player.status}>
                ${!!player.blacklistedAt
            ? `<button class="green" onclick="act('blacklist-remove', JSON.parse(decodeURIComponent('${encodePlayer(player)}')))">${timeAgo(player.blacklistedAt)}</button>`
            : `<button class="red" onclick="act('blacklist', JSON.parse(decodeURIComponent('${encodePlayer(player)}')))">Add</button>`}
            </td>
            <td class=${player.status}>
                <button class="red" onclick="act('lobby-remove', JSON.parse(decodeURIComponent('${encodePlayer(player)}')))">Kick</button>
            </td>
            <td class=${player.status}>
                ${player.seen && player.seen.length > 0
            ? `<button id="toggle-btn-${index}" onclick="toggleSeen(${index})">${openSeen[index] ? `Hide (`+ player.seen.length +`)` : `Show (`+ player.seen.length +`)`}</button>`
            : 'N/A'}
            </td>
        `;
        tbody.appendChild(tr);

        const seenRow = document.createElement('tr');
        seenRow.classList.add('history');
        seenRow.id = `seen-${index}`;
        seenRow.style.display = openSeen[index] ? 'table-row' : 'none';

        if (player.seen && player.seen.length > 0) {
            seenRow.innerHTML = `
            <td colspan="7">
              <div class="history-container">
                <table class="history-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Device ID</th>
                      <th>User ID</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${player.seen.map(s => `
                      <tr>
                        ${(s.name === player.name) ? `<td class="status-emoji">✅</td>` : `<td>`+s.name +`</td>`}
                        ${(s.deviceId === player.deviceId) ? `<td class="status-emoji">✅</td>` : `<td>`+s.deviceId +`</td>`}
                        ${(s.userId === player.userId) ? `<td class="status-emoji">✅</td>` : `<td>`+s.userId +`</td>`}
                        <td>${timeAgo(s.timestamp)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </td>
            `;
            tbody.appendChild(seenRow);
        }
    });
}

function toggleSeen(index) {
    openSeen[index] = !openSeen[index];
    const row = document.getElementById(`seen-${index}`);
    const btn = document.getElementById(`toggle-btn-${index}`);
    if (row) {
        row.style.display = openSeen[index] ? 'table-row' : 'none';
    }
    if (btn) {
        btn.textContent = openSeen[index] ? 'Hide' : 'Show';
    }
}

function encodePlayer(player) {
    return encodeURIComponent(JSON.stringify(player));
}

function act(type, player) {
    const query = new URLSearchParams({
        name: player.name,
        deviceId: player.deviceId,
        userId: player.userId,
    }).toString();

    fetch(`/${type}?${query}`).then(fetchLobby);
}

setInterval(fetchLobby, 1000);
window.onload = fetchLobby;
