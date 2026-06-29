const API_BASE_URL = 'https://caretrack-b5lk.onrender.com/api';

async function callApi(endpoint, method = 'GET', body = null) {
    const user = JSON.parse(localStorage.getItem('user'));
    const headers = {
        'Content-Type': 'application/json'
    };

    if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
    }

    const config = {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong');
        }

        return data;
    } catch (error) {
        console.error('API Call Error:', error);
        throw error;
    }
}
