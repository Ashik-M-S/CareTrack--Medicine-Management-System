const user = checkAuth();
document.getElementById('userName').innerText = user.name;
document.getElementById('currentDate').innerText = formatDDMMYYYY(new Date());

function formatDDMMYYYY(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function formatTime12h(timeStrOrDate) {
    let date;
    if (typeof timeStrOrDate === 'string' && timeStrOrDate.includes(':')) {
        const [h, m] = timeStrOrDate.split(':');
        date = new Date();
        date.setHours(parseInt(h), parseInt(m), 0, 0);
    } else {
        date = new Date(timeStrOrDate);
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

async function loadRequests() {
    try {
        const requests = await callApi('/patient/requests');
        const section = document.getElementById('requestsSection');
        const container = document.getElementById('requestsList');

        if (requests.length > 0) {
            section.style.display = 'block';
            container.innerHTML = '';
            requests.forEach(r => {
                const card = document.createElement('div');
                card.className = 'card glass animate-fade';
                card.innerHTML = `
                    <h3>Request from ${r.caretaker.name}</h3>
                    <p style="color: var(--text-muted); margin-bottom: 1rem;">This user wants to manage your medicines.</p>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary" style="flex: 1;" onclick="handleRequest('${r._id}', 'accepted')">Accept</button>
                        <button class="btn btn-outline" style="flex: 1;" onclick="handleRequest('${r._id}', 'rejected')">Reject</button>
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            section.style.display = 'none';
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleRequest(requestId, status) {
    try {
        await callApi(`/patient/request/${requestId}`, 'PUT', { status });
        alert(`Request ${status}!`);
        loadRequests();
        loadMedicines();
    } catch (err) {
        alert(err.message);
    }
}

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

async function loadProfile() {
    try {
        const profile = await callApi('/auth/profile');
        if (profile.email) document.getElementById('profileEmail').value = profile.email;
        if (profile.age) document.getElementById('profileAge').value = profile.age;
        if (profile.gender) document.getElementById('profileGender').value = profile.gender;
        if (profile.dob) {
            const dateStr = new Date(profile.dob).toISOString().split('T')[0];
            document.getElementById('profileDob').value = dateStr;
        }
        if (profile.phone) document.getElementById('profilePhone').value = profile.phone;
    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('profileEmail').value;
    const age = document.getElementById('profileAge').value;
    const gender = document.getElementById('profileGender').value;
    const dob = document.getElementById('profileDob').value;
    const phone = document.getElementById('profilePhone').value;

    try {
        const updatedUser = await callApi('/auth/profile', 'PUT', { email, age, gender, dob, phone });
        // Update local session data
        const currentUser = JSON.parse(localStorage.getItem('user'));
        currentUser.email = updatedUser.email;
        localStorage.setItem('user', JSON.stringify(currentUser));

        alert('Profile saved successfully!');
        closeModal('profileModal');
    } catch (err) {
        alert(err.message);
    }
});

let cachedLogs = [];
let cachedMedicines = [];

async function loadMedicines() {
    try {
        const meds = await callApi(`/medicine/patient/${user._id}`);
        cachedMedicines = meds;
        const container = document.getElementById('medicineList');

        if (meds.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem;">You don't have any medicines scheduled yet by your caretaker.</p>`;
        } else {
            container.innerHTML = '';
            meds.forEach(m => {
                const now = new Date();
                const start = new Date(m.startDate);
                const duration = m.duration;
                const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
                const daysLeft = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));

                const card = document.createElement('div');
                card.className = 'card glass animate-fade';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h3 style="margin-bottom: 0.25rem;">${m.name}</h3>
                            <p style="color: var(--primary-color); font-weight: 700;">${m.dosage}</p>
                            <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem;">
                                Added: ${formatDDMMYYYY(m.startDate)} | Duration: ${m.duration} days
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 0.75rem; color: var(--primary-color); font-weight: 600;">${daysLeft} days left</span>
                            <br>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.5rem;" onclick="viewLogs('${m._id}')">View Logs</button>
                        </div>
                    </div>
                    <div style="margin: 1.5rem 0;">
                        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.5rem;">Scheduled Times:</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                            ${m.intakeTimes.map(t => `<span class="glass" style="padding: 0.25rem 0.75rem; border-radius: 2rem; font-size: 0.875rem;">${formatTime12h(t)}</span>`).join('')}
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        // After meds load, load logs to calculate analytics
        loadLogsAndAnalytics();
    } catch (err) {
        console.error(err);
    }
}

async function loadLogsAndAnalytics() {
    const now = new Date();
    const currentHHmm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const todayStr = now.toDateString();

    try {
        cachedLogs = await callApi(`/medicine/patient/${user._id}/logs`);

        // Render Missed
        const missedList = document.getElementById('missedMedicinesList');
        const missedLogs = cachedLogs.filter(l => l.status === 'missed');
        if (missedLogs.length === 0) {
            missedList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No missed doses recorded.</p>';
        } else {
            missedList.innerHTML = missedLogs.map(l => {
                const med = l.medicine || {};
                const dateStr = formatDDMMYYYY(l.scheduledDate);
                return `<div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 0.875rem;">
                    <strong>${med.name || 'Unknown'}</strong> <br>
                    <small style="color: var(--text-muted);">${dateStr} at ${formatTime12h(l.scheduledTime)}</small>
                </div>`;
            }).join('');
        }

        // Render Upcoming (Next 24 Hours)
        const upcomingList = document.getElementById('upcomingMedicinesList');
        const upcomingDoses = [];

        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toDateString();

        cachedMedicines.forEach(m => {
            const start = new Date(m.startDate);
            const duration = m.duration;
            const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

            // Filter out expired medicines
            if (now > end) return;

            const daysLeft = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));

            m.intakeTimes.forEach(t => {
                // Today
                if (t > currentHHmm) {
                    upcomingDoses.push({
                        name: m.name,
                        time: t,
                        date: todayStr,
                        daysLeft: daysLeft,
                        sortVal: `0_${t}`
                    });
                }
                // Tomorrow
                if (t <= currentHHmm) {
                    upcomingDoses.push({
                        name: m.name,
                        time: t,
                        date: tomorrowStr,
                        daysLeft: daysLeft,
                        sortVal: `1_${t}`
                    });
                }
            });
        });

        upcomingDoses.sort((a, b) => a.sortVal.localeCompare(b.sortVal));

        if (upcomingDoses.length === 0) {
            upcomingList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No upcoming doses scheduled in next 24h.</p>';
        } else {
            upcomingList.innerHTML = upcomingDoses.map(d => {
                const isToday = d.date === todayStr;
                return `<div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 0.875rem;">
                    <strong>${d.name}</strong> <small style="color: var(--text-muted);">(${d.daysLeft} days left)</small> <br>
                    <span style="color: var(--primary-color); font-weight: 600;">${isToday ? 'Today' : 'Tomorrow'} at ${formatTime12h(d.time)}</span>
                </div>`;
            }).join('');
        }

    } catch (err) {
        console.error('Failed to load logs:', err);
    }
}

function viewLogs(medicineId) {
    const list = document.getElementById('logsModalList');
    const logs = cachedLogs.filter(l => l.medicine && l.medicine._id === medicineId);

    if (logs.length === 0) {
        list.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No logs found for this medicine.</p>`;
    } else {
        list.innerHTML = logs.map(l => {
            const dateStr = formatDDMMYYYY(l.scheduledDate);
            const color = l.status === 'taken' ? 'var(--primary-color)' : 'var(--danger-color)';
            return `
            <div class="card glass" style="margin-bottom: 1rem; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">SCHEDULED</span>
                        <strong>${dateStr} at ${formatTime12h(l.scheduledTime)}</strong>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">STATUS</span>
                        <div style="color: ${color}; font-weight: 600; text-transform: capitalize;">
                            ${l.status}
                        </div>
                    </div>
                </div>
                ${l.takenAt ? `<div style="font-size: 0.8rem; border-top: 1px solid rgba(0,0,0,0.1); margin-top: 0.75rem; padding-top: 0.5rem;">
                    <span style="color: var(--text-muted);">Recorded at:</span> ${new Date(l.takenAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>` : ''}
            </div>
            `;
        }).join('');
    }
    openModal('logsModal');
}

async function deleteAccount() {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone and will sever your connection to your caretaker.")) {
        try {
            await callApi('/auth/account', 'DELETE');
            alert('Account deleted successfully.');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        } catch (err) {
            alert(err.message);
        }
    }
}

async function loadHealthNotes() {
    const notesList = document.getElementById('healthNotesList');
    try {
        const notes = await callApi('/notes/my');
        if (notes.length === 0) {
            notesList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No health notes from your caretaker yet.</p>';
        } else {
            notesList.innerHTML = notes.map(n => {
                const caretakerName = (n.caretaker && n.caretaker.name) ? n.caretaker.name : 'Caretaker';
                return `<div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 0.875rem;">
                    <strong>${n.description}</strong> <br>
                    <small style="color: var(--text-muted);">${formatDDMMYYYY(n.scheduledDate)} at ${formatTime12h(n.scheduledTime)} — by ${caretakerName}</small>
                </div>`;
            }).join('');
        }
    } catch (err) {
        notesList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">Failed to load notes.</p>';
        console.error(err);
    }
}

async function openCaretakerModal() {
    const caretakerDetails = document.getElementById('caretakerModalContent');
    openModal('myCaretakerModal');
    try {
        const caretaker = await callApi('/patient/caretaker', 'GET');

        const detailsHtml = `
            <div style="background: rgba(0,0,0,0.03); padding: 1rem; border-radius: 0.5rem; border: 1px solid rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 1rem;">
                <p><strong>Name:</strong> ${caretaker.name || 'N/A'}</p>
                <p><strong>Email:</strong> ${caretaker.email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${caretaker.phone || 'N/A'}</p>
                <p><strong>Gender:</strong> ${caretaker.gender || 'N/A'}</p>
            </div>
        `;
        caretakerDetails.innerHTML = detailsHtml;
    } catch (err) {
        caretakerDetails.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No caretaker assigned or failed to load.</p>';
        console.error('Failed to load caretaker details:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    loadRequests();
    loadMedicines();
    loadHealthNotes();
});
