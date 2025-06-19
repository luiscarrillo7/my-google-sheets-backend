// my-sheets-frontend/script.js
document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const checkButton = document.getElementById('checkButton');
    const messageDisplay = document.getElementById('message');

    const BACKEND_URL = 'https://my-google-sheets-backend.onrender.com';

    checkButton.addEventListener('click', async () => {
        const valor = userInput.value.trim();

        if (!valor) {
            messageDisplay.textContent = 'Por favor, ingresa un número de usuario.';
            messageDisplay.className = 'message-error';
            return;
        }

        messageDisplay.textContent = 'Verificando...';
        messageDisplay.className = '';
        checkButton.disabled = true;

        try {
            const response = await fetch(`${BACKEND_URL}/api/check-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ valor: valor }),
            });

            const data = await response.json();

            if (response.ok) {
                if (data.exists) {
                    // ** CAMBIO AQUÍ: Mostrar nombre y apellido **
                    messageDisplay.textContent = `¡Usuario existe! Nombre: ${data.nombre}, Apellido: ${data.apellido}`;
                    messageDisplay.className = 'message-success';
                } else {
                    messageDisplay.textContent = 'Usuario no encontrado.';
                    messageDisplay.className = 'message-error';
                }
            } else {
                console.error('Error del servidor:', data.message || response.statusText);
                messageDisplay.textContent = `Error: ${data.message || 'Algo salió mal en el servidor.'}`;
                messageDisplay.className = 'message-error';
            }

        } catch (error) {
            console.error('Error al comunicarse con el backend:', error);
            messageDisplay.textContent = 'Error de conexión. Asegúrate de que el backend esté ejecutándose.';
            messageDisplay.className = 'message-error';
        } finally {
            checkButton.disabled = false;
        }
    });
});