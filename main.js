const API_BASE_URL = "http://127.0.0.1:5000/api";

// --- Helper for API calls ---
async function api(path, method = 'GET', body = null) {
    const token = localStorage.getItem('authToken');
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    // Only add the Authorization header if a token exists
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(API_BASE_URL + path, options);

        // If the response is not OK (e.g., 401, 404, 500),
        // it will still try to parse the JSON body for an error message.
        if (!response.ok) {
            // Check for an expired token specifically on non-login pages
            if (response.status === 401 && path !== '/login' && path !== '/register') {
                logout(); // Session expired, log out
                return { error: 'Session expired. Please log in again.' };
            }
            // For login errors or other issues, return the server's JSON error
            return await response.json(); 
        }

        // For successful responses (200-299), return the JSON body
        return await response.json();

    } catch (error) {
        console.error('API Call Error:', error);
        return { error: 'Network error or server is down.' };
    }
}

// --- Auth Functions ---
function handleAuth(event, endpoint) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    api(endpoint, 'POST', data).then(res => {
        if (res.error) {
            alert(res.error);
        } else if (res.token) { // Login successful
            localStorage.setItem('authToken', res.token);
            window.location.href = "/index.html";
        } else { // Register successful
            alert('Registration successful! Please login.');
            window.location.href = "/login.html";
        }
    });
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = "/login.html";
}

// --- Page Specific Logic ---

// Dashboard Page
function loadDashboard() {
    const heroTitle = document.getElementById('heroTitle');
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            heroTitle.textContent = `Welcome back, ${payload.user_name}!`;
        } catch(e) { console.error('Error decoding token:', e); }
    }

    // Load latest score
    const scoreElement = document.getElementById("latestScore");
    api('/screenings/latest', 'GET').then(data => {
        if (data && !data.error) {
            let color = "#28a745"; // Minimal
            if (data.risk_level === "Mild") color = "#ffc107";
            else if (data.risk_level === "Moderate") color = "#fd7e14";
            else if (data.risk_level.includes("High")) color = "#dc3545";

            scoreElement.textContent = `Score: ${data.score} (${data.risk_level})`;
            scoreElement.style.backgroundColor = color;
        } else {
            scoreElement.textContent = "No score available yet";
            scoreElement.style.backgroundColor = "#6c757d";
        }
    });
}

// Screening Page
function setupScreeningPage() {
    const questions = [
        "Little interest or pleasure in doing things?", "Feeling down, depressed, or hopeless?",
        "Trouble falling or staying asleep, or sleeping too much?", "Feeling tired or having little energy?",
        "Poor appetite or overeating?", "Feeling bad about yourself — or that you are a failure?",
        "Trouble concentrating on things?", "Moving or speaking so slowly that others notice?",
        "Thoughts that you would be better off dead or hurting yourself?", "Feeling anxious or nervous frequently?"
    ];
    const container = document.getElementById("questionsContainer");
    questions.forEach((q, index) => {
        container.innerHTML += `
            <div class="mb-3">
                <label class="form-label">${index + 1}. ${q}</label>
                <select class="form-select" required data-question-index="${index}">
                    <option value="" disabled selected>Select an option</option>
                    <option value="0">Not at all</option>
                    <option value="1">Several days</option>
                    <option value="2">More than half the days</option>
                    <option value="3">Nearly every day</option>
                </select>
            </div>`;
    });

    document.getElementById("screeningForm").addEventListener("submit", event => {
        event.preventDefault();
        const answers = Array.from(document.querySelectorAll("select")).map(sel => parseInt(sel.value));
        
        api('/screenings', 'POST', { answers }).then(res => {
            if (res.error) {
                alert(res.error);
            } else {
                localStorage.setItem('lastScreeningId', res.id);
                window.location.href = '/results.html';
            }
        });
    });
}

// Results Page
function loadResults() {
    const latestScreening = JSON.parse(localStorage.getItem('latestScreening'));
    if (!latestScreening) {
        document.body.innerHTML = '<h1>No screening data found. Please complete a screening first.</h1><a href="/screening.html">Go to Screening</a>';
        return;
    }

    const { score, risk_level, flagged } = latestScreening;
    const resultAlert = document.getElementById("resultAlert");
    const scoreDisplay = document.getElementById("scoreDisplay");
    let resultText = "";
    let alertClass = "";

    if (risk_level === "Minimal") { resultText = "✅ Your symptoms are minimal."; alertClass = "alert-success"; }
    else if (risk_level === "Mild") { resultText = "⚠️ You show signs of mild symptoms."; alertClass = "alert-info"; }
    else if (risk_level === "Moderate") { resultText = "⚠️ You show signs of moderate symptoms. Consider seeking guidance."; alertClass = "alert-warning"; }
    else { resultText = "❌ You show signs of high-risk symptoms. Professional help is strongly recommended."; alertClass = "alert-danger"; }

    if (flagged) {
        resultText += "<br><strong>This screening has been flagged as high-risk.</strong> Please seek professional help.";
    }

    resultAlert.className = `alert ${alertClass} text-center`;
    resultAlert.innerHTML = `<h4>${resultText}</h4>`;
    scoreDisplay.innerText = score;
}

// Tracking Page
function loadTrackingChart() {
    api('/screenings/history', 'GET').then(history => {
        const labels = history.map(item => item.date);
        const data = history.map(item => item.score);

        const ctx = document.getElementById('moodChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Screening Score Over Time',
                    data: data,
                    borderColor: '#6a11cb',
                    backgroundColor: 'rgba(106, 17, 203, 0.2)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, max: 40 } },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    });
}


// Appointments Page
function handleAppointmentBooking(event) {
    event.preventDefault();
    const form = event.target;
    const name = form.querySelector('#appt_name').value;
    const date = form.querySelector('#appt_date').value;
    const time = form.querySelector('#appt_time').value;

    api('/appointments', 'POST', { name, date, time }).then(res => {
        if (res.error) {
            alert(res.error);
        } else {
            alert(res.message);
            form.reset();
        }
    });
}

// Admin Page
function loadAdminFlags() {
    const container = document.getElementById('flags-container');
    api('/admin/flags', 'GET').then(flags => {
        if (flags.length === 0) {
            container.innerHTML = '<p>No flagged screenings found.</p>';
            return;
        }
        let html = '<ul class="list-group">';
        flags.forEach(f => {
            const date = new Date(f.created_at).toLocaleString();
            html += `
                <li class="list-group-item">
                    <strong>User:</strong> ${f.user_name} | 
                    <strong>Score:</strong> ${f.score} (${f.risk_level}) | 
                    <strong>Date:</strong> ${date}
                </li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
    });
}

// --- Main Initializer ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // Redirect to login if no token, except on login/register pages
    if (!localStorage.getItem('authToken') && path !== '/login.html' && path !== '/register.html') {
        window.location.href = '/login.html';
        return;
    }

    // Sidebar toggle
    const sidebar = document.getElementById("sidebar");
    const dashboardToggle = document.getElementById("dashboardToggle");
    if (sidebar && dashboardToggle) {
        dashboardToggle.addEventListener("click", () => {
            sidebar.classList.toggle("expanded");
        });
    }

    // Page-specific initializers
    if (path.endsWith('/') || path.endsWith('/index.html')) { loadDashboard(); }
    if (path.endsWith('/screening.html')) { setupScreeningPage(); }
    if (path.endsWith('/results.html')) { loadResults(); }
    if (path.endsWith('/tracking.html')) { loadTrackingChart(); }
    if (path.endsWith('/admin.html')) { loadAdminFlags(); }

    // Form handlers
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', (e) => handleAuth(e, '/login'));

    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', (e) => handleAuth(e, '/register'));
    
    const apptForm = document.getElementById('appointmentForm');
    if (apptForm) apptForm.addEventListener('submit', handleAppointmentBooking);

});