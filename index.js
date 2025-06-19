// my-google-sheets-backend/index.js
require('dotenv').config(); // Para usar variables de entorno en desarrollo local

const express = require('express');
const cors = require('cors'); // Para permitir que tu frontend se comunique con este backend
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000; // El puerto en el que correrá tu backend

// Middleware para parsear JSON en el cuerpo de las solicitudes (ej. cuando envías datos desde el frontend)
app.use(express.json());

// --- Configuración de CORS ---
// IMPORTANTE: Reemplaza 'https://tu-frontend.onrender.com' con la URL REAL de tu frontend cuando la tengas.
// Para desarrollo local, http://localhost:PORT_DEL_FRONTEND es importante.
const allowedOrigins = [
    'https://my-sheets-frontend.onrender.com', // ¡CÁMBIAME A LA URL DE TU FRONTEND EN RENDER!
    'http://localhost:5000',             // Ejemplo para tu frontend local (si lo corres en el puerto 5000 con `serve`)
    'http://localhost:3001'              // Otro ejemplo si usas otro puerto para el frontend local
];
app.use(cors({
    origin: function (origin, callback) {
        // Permitir solicitudes sin 'origin' (ej. de Postman/Thunder Client o cuando se abre directamente el HTML localmente)
        if (!origin) return callback(null, true);
        // Si el origen está en nuestra lista de orígenes permitidos
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'La política CORS para este sitio no permite el acceso desde el Origen especificado.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));


// --- Configuración de Google Sheets ---
const GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64 = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Hoja1';
const ENCODING_TYPE = process.env.ENCODING_TYPE; // Nueva variable para el tipo de codificación

// Verificación inicial de que las variables de entorno están presentes
if (!GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64 || !GOOGLE_SHEET_ID) {
    console.error("ERROR: Faltan las variables de entorno GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64 o GOOGLE_SHEET_ID.");
    process.exit(1);
}

let sheetsClient;

async function authenticateGoogleSheets() {
    try {
        let credentialsJsonString;

        // Decodifica si la variable está en Base64
        if (ENCODING_TYPE === 'base64') {
            credentialsJsonString = Buffer.from(GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64, 'base64').toString('utf8');
        } else {
            // Si no está codificada, la usa directamente (menos recomendable si hay caracteres especiales)
            credentialsJsonString = GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64;
        }

        const credentials = JSON.parse(credentialsJsonString); // Aquí se parsea el JSON
        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const authClient = await auth.getClient();
        sheetsClient = google.sheets({ version: 'v4', auth: authClient });
        console.log("Autenticación de Google Sheets exitosa. Cliente de Sheets inicializado.");
    } catch (error) {
        console.error("Error al autenticar con Google Sheets:", error.message);
        process.exit(1);
    }
}

// Llama a la función de autenticación al iniciar el servidor
authenticateGoogleSheets();


// --- Endpoint para verificar existencia de usuario ---
app.post('/api/check-user', async (req, res) => {
    // Obtenemos el valor enviado desde el frontend en el cuerpo de la solicitud (JSON)
    const { valor } = req.body;

    if (!valor) {
        // Si no se envía ningún valor, respondemos con un error 400 (Bad Request)
        return res.status(400).json({ message: "Se requiere un valor para la consulta." });
    }

    try {
        // Verificamos que el cliente de Sheets se haya inicializado correctamente
        if (!sheetsClient) {
            throw new Error("El cliente de Google Sheets no está inicializado. Error de autenticación previa.");
        }

        // Leer datos de la primera columna (A) de tu hoja.
        // Asegúrate de que 'Hoja1' (o el valor de GOOGLE_SHEET_NAME) sea el nombre exacto de tu hoja en Google Sheets.
        const response = await sheetsClient.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `${GOOGLE_SHEET_NAME}!A:A`, // Especifica la columna A completa
        });

        const rows = response.data.values; // Obtiene todas las filas de la columna A
        let userExists = false;

        if (rows && rows.length > 0) {
            // Recorre cada fila y verifica si el valor (ignorando mayúsculas/minúsculas) existe en la primera columna (índice 0)
            userExists = rows.some(row =>
                row[0] && row[0].toString().toLowerCase() === valor.toLowerCase()
            );
        }

        // Responde al frontend si el usuario existe o no
        if (userExists) {
            res.json({ message: "Usuario existe.", exists: true });
        } else {
            res.json({ message: "Usuario no encontrado.", exists: false });
        }

    } catch (error) {
        console.error("Error al consultar Google Sheets:", error);
        // En caso de error, respondemos con un error 500 (Internal Server Error)
        res.status(500).json({ message: "Error interno del servidor al consultar Google Sheets." });
    }
});

// --- Endpoint de prueba simple ---
// Puedes acceder a este en tu navegador para verificar que el backend está corriendo
app.get('/', (req, res) => {
    res.send('¡Backend funcionando! Usa el endpoint /api/check-user para verificar usuarios.');
});

// --- Iniciar el servidor ---
app.listen(PORT, () => {
    console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
    console.log(`Asegúrate de que tus variables de entorno estén configuradas en un archivo .env si estás en desarrollo local.`);
});