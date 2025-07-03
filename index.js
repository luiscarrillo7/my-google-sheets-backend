// my-google-sheets-backend/index.js

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();

const GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64, process.env.ENCODING_TYPE).toString('utf8')
);
const GOOGLE_SHEET_ID_DATOS = process.env.GOOGLE_SHEET_ID_DATOS;
const GOOGLE_SHEET_NAME_DATOS = process.env.GOOGLE_SHEET_NAME_DATOS || 'Hoja1';

const allowedOrigins = [
    'https://my-sheets-frontend.onrender.com',
    'http://localhost:5000',
    'http://localhost:3000',
    'https://capacitacion-dirisle.googlesites.cloud',
    'https://www.capacitacion-dirisle.googlesites.cloud',
    'https://prueba.googlesites.cloud',
    'https://prueba.googlesites.cloud'
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

app.use(express.json());

async function getAuthClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: GOOGLE_SERVICE_ACCOUNT_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return await auth.getClient();
}

app.post('/api/check-user', async (req, res) => {
    const { valor } = req.body;

    // Log para ver el valor recibido en el backend
    console.log('Backend: Recibida solicitud para /api/check-user. Valor enviado:', valor);

    if (!valor) {
        console.log('Backend: Valor vacío. Devolviendo error 400.');
        return res.status(400).json({ message: 'El campo "valor" es requerido.' });
    }

    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        // **** Rango de A a M (sigue siendo correcto) ****
        const responseDatos = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID_DATOS,
            range: `${GOOGLE_SHEET_NAME_DATOS}!A:M`,
        });

        const rows = responseDatos.data.values;
        // Log para ver todos los datos leídos de la hoja
        console.log('Backend: Datos leídos de la hoja de cálculo (incluyendo encabezados):', rows);

        if (rows && rows.length > 0) {
            // Saltar la fila de encabezado
            const dataRows = rows.slice(1);

            // **** CAMBIO CLAVE AQUÍ: Buscar en la Columna B (índice 1) ****
            // Usamos .trim() para quitar posibles espacios extra en los datos
            const foundUser = dataRows.find(row => (row[1] || '').trim() === valor.trim());

            if (foundUser) {
                console.log('Backend: Usuario encontrado en la hoja de cálculo:', foundUser); // Log del usuario completo encontrado

                // **** EXTRACCIÓN DE DATOS DE LAS COLUMNAS CORRECTAS SEGÚN TU IMAGEN ****
                // Asegúrate de que cada campo exista antes de intentar acceder a él, o proporciona un valor por defecto
                const idUsuario = foundUser[1] || ''; // Columna B (donde está el ID numérico)
                const nombre = foundUser[2] || ''; // Columna C (Nombre Completo)
                const cargo = foundUser[3] || ''; // Columna D (Cargo)
                const eess = foundUser[5] || ''; // Columna E (EESS)
                const ris = foundUser[6] || ''; // Columna F (RIS)
                // foundUser[6] hasta foundUser[10] serían columnas G, H, I, J, K - las omitimos si no son relevantes
                const horas = foundUser[12] || ''; // Columna L (Horas/Fecha)
                const puntaje = foundUser[13] || ''; // Columna M (Puntaje)

                // **** Envío de todos los campos ****
                return res.json({
                    exists: true,
                    message: 'Usuario existe.',
                    idUsuario, // Este es el valor buscado
                    nombre,
                    cargo,
                    eess,
                    ris,
                    horas,
                    puntaje
                });
            }
        }

        console.log('Backend: Usuario no encontrado en la hoja de cálculo (después de buscar).');
        return res.json({ exists: false, message: 'Usuario no encontrado.' });

    } catch (error) {
        console.error('Backend: Error al acceder a Google Sheet:', error.message, error.stack);
        return res.status(500).json({ message: 'Error interno del servidor al verificar el usuario.' });
    }
});

app.get('/', (req, res) => {
    res.send('¡Backend funcionando! Usa el endpoint /api/check-user para verificar usuarios.');
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor backend escuchando en http://0.0.0.0:${port}`);
});