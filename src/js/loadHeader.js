async function loadHeader() {
    const headerContainer = document.getElementById('headerContainer');
    if (headerContainer) {
        try {
            const response = await fetch('../html/components/header.html');
            const headerHtml = await response.text();
            headerContainer.innerHTML = headerHtml;
            
            // After loading the header, execute any additional logic
            const username = localStorage.getItem('email') || 'Guest';
            document.getElementById('usernameDisplay').textContent = username;
        } catch (error) {
            console.error('Error loading header:', error);
        }
    }
}

function logout() {
    // Implement your logout logic here    
    localStorage.removeItem('authToken'); // Clear the token
    window.location.href = 'login.html'; // Redirect to login page
}

window.onload = loadHeader;
