// my-google-sheets-backend/index.js

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();

// ** 1. Variables de Entorno **
// (Asegúrate de configurar GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64, ENCODING_TYPE en Render)
const GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64, process.env.ENCODING_TYPE).toString('utf8')
);
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID; // Para el sheet 'credencial' (si aún lo usas)
const GOOGLE_SHEET_NAME = process.env.GOOGLE_SHEET_NAME; // Para el sheet 'credencial'

// ** NUEVAS VARIABLES DE ENTORNO PARA EL SHEET 'datos' **
const GOOGLE_SHEET_ID_DATOS = process.env.GOOGLE_SHEET_ID_DATOS; // ¡Nueva variable!
const GOOGLE_SHEET_NAME_DATOS = process.env.GOOGLE_SHEET_NAME_DATOS || 'Hoja1'; // Asume 'Hoja1' si no se especifica

// Configuración CORS
const allowedOrigins = [
    'https://my-sheets-frontend.onrender.com', // Tu frontend en Render
    'http://localhost:5000', // Para desarrollo local de tu frontend
    'http://localhost:3000'  // Si tu backend corre localmente y lo pruebas desde el mismo origen
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json()); // Para parsear cuerpos de solicitud JSON

// ** 2. Función de autenticación para Google Sheets **
async function getAuthClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: GOOGLE_SERVICE_ACCOUNT_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Solo lectura
    });
    return await auth.getClient();
}

// ** 3. Endpoint para verificar usuario y obtener datos (modificado) **
app.post('/api/check-user', async (req, res) => {
    const { valor } = req.body;

    if (!valor) {
        return res.status(400).json({ message: 'El campo "valor" es requerido.' });
    }

    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        // ** AHORA BUSCAMOS EN EL SHEET 'datos' **
        const responseDatos = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID_DATOS, // Usamos el ID del sheet 'datos'
            range: `${GOOGLE_SHEET_NAME_DATOS}!A:B`, // Rango de columnas A y B
        });

        const rows = responseDatos.data.values;

        if (rows && rows.length) {
            // Asume que la columna A es el usuario y la B es el apellido
            const foundUser = rows.find(row => row[0] === valor); // Busca en la columna A

            if (foundUser) {
                const nombre = foundUser[0]; // Columna A (usuario)
                const apellido = foundUser[1]; // Columna B (apellido)
                return res.json({ exists: true, message: 'Usuario existe.', nombre, apellido });
            }
        }

        // Si no se encuentra en 'datos'
        return res.json({ exists: false, message: 'Usuario no encontrado.' });

    } catch (error) {
        console.error('Error al acceder a Google Sheet:', error.message, error.stack);
        return res.status(500).json({ message: 'Error interno del servidor al verificar el usuario.' });
    }
});

// Endpoint principal para verificación
app.get('/', (req, res) => {
    res.send('¡Backend funcionando! Usa el endpoint /api/check-user para verificar usuarios.');
});

// Iniciar el servidor
const port = process.env.PORT || 10000; // Render usará su propia variable PORT
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor backend escuchando en http://0.0.0.0:${port}`);
});