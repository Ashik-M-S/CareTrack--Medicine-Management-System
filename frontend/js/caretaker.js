const user = checkAuth();
document.getElementById('userName').innerText = user.name;

let globalLogs = [];
let globalMedicines = [];

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

async function loadPatients() {
    try {
        const patients = await callApi('/caretaker/patients');
        cachedPatients = patients; // Store for health notes
        const container = document.getElementById('patientList');

        if (patients.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem;">No patients added yet. Start by adding a patient using their email.</p>`;
            return;
        }

        container.innerHTML = '';
        patients.forEach(p => {
            const card = document.createElement('div');
            card.className = 'card glass animate-fade';
            card.innerHTML = `
                <h3 style="margin-bottom: 0.5rem;">${p.name}</h3>
                <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem;">${p.email}</p>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary" style="flex: 1; padding: 0.5rem;" onclick="openAddMedicine('${p._id}')">Schedule Meds</button>
                        <button class="btn btn-outline" style="flex: 1; padding: 0.5rem;" onclick="viewMedicines('${p._id}', '${p.name}')">Manage Meds</button>
                    </div>
                    <button class="btn btn-outline" style="width: 100%; border-color: var(--danger-color); color: var(--danger-color); padding: 0.5rem;" onclick="removePatient('${p._id}')">Remove Patient</button>
                </div>
            `;
            container.appendChild(card);
        });

        // After rendering patients, load analytics
        globalLogs = [];
        globalMedicines = [];
        for (const p of patients) {
            try {
                const meds = await callApi(`/medicine/patient/${p._id}`);
                const logs = await callApi(`/medicine/patient/${p._id}/logs`);

                meds.forEach(m => m.patientName = p.name);
                logs.forEach(l => { if (l.medicine) l.medicine.patientName = p.name; });

                globalMedicines.push(...meds);
                globalLogs.push(...logs);
            } catch (err) {
                console.error('Failed to load data for patient', p._id, err);
            }
        }
        renderGlobalAnalytics();
        loadHealthNotes();

    } catch (err) {
        console.error(err);
    }
}

function renderGlobalAnalytics() {
    const now = new Date();
    const currentHHmm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const todayStr = now.toDateString();

    // Render Missed
    const missedList = document.getElementById('missedMedicinesList');
    const missedLogs = globalLogs.filter(l => l.status === 'missed');
    if (missedLogs.length === 0) {
        missedList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No missed doses recorded across patients.</p>';
    } else {
        missedList.innerHTML = missedLogs.map(l => {
            const med = l.medicine || {};
            const dateStr = formatDDMMYYYY(l.scheduledDate);
            return `<div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong>${med.patientName || 'Patient'}</strong>: ${med.name || 'Unknown'} <br>
                  <small style="color: var(--text-muted);">${dateStr} at ${formatTime12h(l.scheduledTime)}</small>
                </div>
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openTimingSelection('${med._id}', '${med.name}')">Mark Taken</button>
            </div>`;
        }).join('');
    }

    // Render Upcoming (Next 24 Hours)
    const upcomingList = document.getElementById('upcomingMedicinesList');
    const upcomingDoses = [];

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toDateString();

    globalMedicines.forEach(m => {
        const start = new Date(m.startDate);
        const duration = m.duration;
        const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

        // Filter out expired medicines
        if (now > end) return;

        const daysLeft = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));

        m.intakeTimes.forEach(t => {
            // Check Today
            if (t > currentHHmm) {
                upcomingDoses.push({
                    patientName: m.patientName,
                    name: m.name,
                    time: t,
                    date: todayStr,
                    daysLeft: daysLeft,
                    sortVal: `0_${t}`
                });
            }
            // Check Tomorrow (instances within 24h)
            if (t <= currentHHmm) {
                upcomingDoses.push({
                    patientName: m.patientName,
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
        upcomingList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No upcoming doses scheduled in the next 24h.</p>';
    } else {
        upcomingList.innerHTML = upcomingDoses.map(d => {
            const isToday = d.date === todayStr;
            return `<div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 0.875rem;">
                <strong>${d.patientName}</strong>: ${d.name} <small style="color: var(--text-muted);">(${d.daysLeft} days left)</small> <br>
                <span style="color: var(--primary-color); font-weight: 600;">${isToday ? 'Today' : 'Tomorrow'} at ${formatTime12h(d.time)}</span>
            </div>`;
        }).join('');
    }
}

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function openAddMedicine(patientId) {
    document.getElementById('currentPatientId').value = patientId;
    document.getElementById('intakeTimesContainer').innerHTML = '';
    addIntakeTimeSlot(); // Start with one slot
    openModal('addMedicineModal');
}

function addIntakeTimeSlot() {
    const container = document.getElementById('intakeTimesContainer');
    const slot = document.createElement('div');
    slot.className = 'intake-time-slot';
    slot.style.display = 'flex';
    slot.style.gap = '0.5rem';
    slot.style.alignItems = 'center';

    // Hour options 1-12
    let hourOptions = '';
    for (let i = 1; i <= 12; i++) hourOptions += `<option value="${i}">${i}</option>`;

    // Minute options 00-59 (1 min increments)
    let minuteOptions = '';
    for (let i = 0; i < 60; i++) {
        const val = i.toString().padStart(2, '0');
        minuteOptions += `<option value="${val}">${val}</option>`;
    }

    slot.innerHTML = `
        <select class="med-hour" style="flex: 1; padding: 0.4rem; border-radius: 0.4rem; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.1); color: var(--text-main);">
            ${hourOptions}
        </select>
        <select class="med-minute" style="flex: 1; padding: 0.4rem; border-radius: 0.4rem; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.1); color: var(--text-main);">
            ${minuteOptions}
        </select>
        <select class="med-ampm" style="flex: 1; padding: 0.4rem; border-radius: 0.4rem; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.1); color: var(--text-main);">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
        </select>
        <button type="button" class="btn btn-outline" style="padding: 0.2rem 0.5rem; color: var(--danger-color); border-color: var(--danger-color);" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(slot);
}

document.getElementById('addPatientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('patientEmail').value;
    try {
        await callApi('/caretaker/request', 'POST', { email });
        alert('Care request sent to patient!');
        closeModal('addPatientModal');
        loadPatients();
    } catch (err) {
        alert(err.message);
    }
});

document.getElementById('addMedicineForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const patientId = document.getElementById('currentPatientId').value;

    // Collect all intake times and convert to 24h HH:mm
    const timeSlots = document.querySelectorAll('.intake-time-slot');
    const intakeTimes = Array.from(timeSlots).map(slot => {
        let h = parseInt(slot.querySelector('.med-hour').value);
        const m = slot.querySelector('.med-minute').value;
        const ampm = slot.querySelector('.med-ampm').value;

        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;

        return `${h.toString().padStart(2, '0')}:${m}`;
    });

    if (intakeTimes.length === 0) {
        alert('Please add at least one intake time.');
        return;
    }

    const body = {
        patientId,
        name: document.getElementById('medName').value,
        dosage: document.getElementById('medDosage').value,
        intakeTimes: intakeTimes,
        startDate: new Date(),
        duration: parseInt(document.getElementById('medDuration').value)
    };

    try {
        await callApi('/medicine', 'POST', body);
        alert('Medicine scheduled successfully!');
        closeModal('addMedicineModal');
        loadPatients(); // Refresh list to show new medicine
    } catch (err) {
        alert(err.message);
    }
});

async function removePatient(patientId) {
    if (confirm("Are you sure you want to remove this patient? This will sever all connections and delete related medicines/requests.")) {
        try {
            await callApi(`/caretaker/patient/${patientId}`, 'DELETE');
            alert('Patient removed successfully.');
            loadPatients();
        } catch (err) {
            alert(err.message);
        }
    }
}

async function viewMedicines(patientId, patientName) {
    try {
        const meds = await callApi(`/medicine/patient/${patientId}`);
        const container = document.getElementById('modalMedicineList');

        if (meds.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No medicines scheduled for ${patientName} yet.</p>`;
        } else {
            container.innerHTML = '';
            meds.forEach(m => {
                const now = new Date();
                const start = new Date(m.startDate);
                const duration = m.duration;
                const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
                const daysLeft = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));

                const card = document.createElement('div');
                card.className = 'card glass';
                card.style.marginBottom = '1rem';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h4 style="margin-bottom: 0.25rem;">${m.name}</h4>
                            <p style="color: var(--primary-color); font-weight: 700; font-size: 0.875rem;">${m.dosage}</p>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Times: ${m.intakeTimes.map(t => formatTime12h(t)).join(', ')}</p>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                                Added: ${formatDDMMYYYY(m.startDate)} | Duration: ${m.duration} days
                            </p>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                                <span style="color: var(--primary-color); font-weight: 600;">${daysLeft} days left</span>
                            </p>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <button class="btn btn-primary" style="padding: 0.5rem; font-size: 0.875rem;" onclick="openTimingSelection('${m._id}', '${m.name}')">Mark Dose Taken</button>
                            <div style="display: flex; gap: 0.25rem;">
                                <button class="btn btn-outline" style="flex: 1; padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="viewLogs('${m._id}')">Logs</button>
                                <button class="btn btn-outline" style="flex: 1; padding: 0.25rem 0.5rem; font-size: 0.75rem; border-color: var(--danger-color); color: var(--danger-color);" onclick="deleteMedicine('${m._id}', '${patientId}', '${patientName}')">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }
        openModal('viewMedicinesModal');
    } catch (err) {
        console.error(err);
        alert('Failed to load medicines.');
    }
}

async function markConsumed(medicineId, scheduledTime, scheduledDate = null) {
    const now = new Date();
    // Use selected date if provided (e.g. from missed list), otherwise assume today
    const dateToUse = scheduledDate ? new Date(scheduledDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate());

    try {
        await callApi('/medicine/consume', 'POST', {
            medicineId,
            scheduledTime,
            scheduledDate: dateToUse
        });
        alert(`Dose for ${formatTime12h(scheduledTime)} recorded successfully!`);
        closeModal('timingSelectionModal');
        loadPatients(); // Refresh analytics and missed area
    } catch (err) {
        alert(err.message);
    }
}

function openTimingSelection(medicineId, medicineName) {
    const now = new Date();
    const currentHHmm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const todayStr = now.toDateString();

    // Find the medicine object
    const med = globalMedicines.find(m => m._id === medicineId);
    if (!med) return;

    document.getElementById('timingModalTitle').innerText = `Take ${medicineName}`;
    const list = document.getElementById('timingSelectionList');
    list.innerHTML = '';

    // Filter intakeTimes for today that aren't marked as 'taken'
    const takenToday = globalLogs
        .filter(l => l.medicine && l.medicine._id === medicineId && new Date(l.scheduledDate).toDateString() === todayStr && l.status === 'taken')
        .map(l => l.scheduledTime);

    // Filter missed logs for this med (could be from any date)
    const missedLogs = globalLogs.filter(l => l.medicine && l.medicine._id === medicineId && l.status === 'missed');

    const availableTimings = [];

    // Add today's available (past or current) times
    med.intakeTimes.forEach(t => {
        if (t <= currentHHmm && !takenToday.includes(t)) {
            availableTimings.push({ time: t, date: todayStr, label: formatTime12h(t) });
        }
    });

    // Add other missed logs (from previous days)
    missedLogs.forEach(ml => {
        const mlDateStr = new Date(ml.scheduledDate).toDateString();
        // Skip if it's already in today's list to avoid duplicates
        if (mlDateStr === todayStr) return;

        availableTimings.push({
            time: ml.scheduledTime,
            date: ml.scheduledDate,
            label: `${formatDDMMYYYY(ml.scheduledDate)} at ${formatTime12h(ml.scheduledTime)}`
        });
    });

    if (availableTimings.length === 0) {
        list.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1rem;">No doses available to mark right now.</p>`;
    } else {
        availableTimings.forEach(at => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.style.padding = '1rem';
            btn.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${at.label}</span>
                    <span style="font-size: 0.7rem; color: var(--primary-color);">Mark Taken</span>
                </div>
            `;
            btn.onclick = () => markConsumed(medicineId, at.time, at.date);
            list.appendChild(btn);
        });
    }

    openModal('timingSelectionModal');
}

async function deleteMedicine(medicineId, patientId, patientName) {
    if (confirm("Are you sure you want to delete this medicine and all its intake logs?")) {
        try {
            await callApi(`/medicine/${medicineId}`, 'DELETE');
            alert('Medicine deleted.');
            viewMedicines(patientId, patientName); // Refresh list
        } catch (err) {
            alert(err.message);
        }
    }
}

async function deleteAccount() {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone and will sever ties with all patients.")) {
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

function viewLogs(medicineId) {
    const list = document.getElementById('logsModalList');
    const logs = globalLogs.filter(l => l.medicine && l.medicine._id === medicineId);

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

let cachedPatients = [];

async function loadHealthNotes() {
    const notesList = document.getElementById('healthNotesList');
    try {
        let allNotes = [];
        for (const p of cachedPatients) {
            const notes = await callApi(`/notes/patient/${p._id}`);
            notes.forEach(n => n.patientName = p.name);
            allNotes.push(...notes);
        }

        // Sort by date/time
        allNotes.sort((a, b) => {
            const da = new Date(a.scheduledDate);
            const db = new Date(b.scheduledDate);
            if (da.getTime() !== db.getTime()) return da - db;
            return a.scheduledTime.localeCompare(b.scheduledTime);
        });

        if (allNotes.length === 0) {
            notesList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No health notes yet. Add one using the "+ Health Note" button.</p>';
        } else {
            notesList.innerHTML = allNotes.map(n => {
                return `<div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${n.patientName}</strong>: ${n.description} <br>
                        <small style="color: var(--text-muted);">${formatDDMMYYYY(n.scheduledDate)} at ${formatTime12h(n.scheduledTime)}</small>
                    </div>
                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; border-color: var(--danger-color); color: var(--danger-color);" onclick="deleteNote('${n._id}')">Delete</button>
                </div>`;
            }).join('');
        }
    } catch (err) {
        notesList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">Failed to load notes.</p>';
        console.error(err);
    }
}

function openAddNoteModal() {
    const select = document.getElementById('notePatientId');
    select.innerHTML = '<option value="">Choose a patient...</option>';
    cachedPatients.forEach(p => {
        select.innerHTML += `<option value="${p._id}">${p.name}</option>`;
    });
    openModal('addNoteModal');
}

document.getElementById('addNoteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patientId = document.getElementById('notePatientId').value;
    const description = document.getElementById('noteDescription').value;
    const scheduledDate = document.getElementById('noteDate').value;
    const scheduledTime = document.getElementById('noteTime').value;

    if (!patientId) {
        alert('Please select a patient.');
        return;
    }

    try {
        await callApi('/notes', 'POST', { patientId, description, scheduledDate, scheduledTime });
        alert('Health note added!');
        closeModal('addNoteModal');
        document.getElementById('addNoteForm').reset();
        loadHealthNotes();
    } catch (err) {
        alert(err.message);
    }
});

async function deleteNote(noteId) {
    if (confirm('Delete this health note?')) {
        try {
            await callApi(`/notes/${noteId}`, 'DELETE');
            loadHealthNotes();
        } catch (err) {
            alert(err.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    loadPatients();
});
