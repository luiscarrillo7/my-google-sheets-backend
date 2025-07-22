// Carga las variables de entorno desde un archivo .env si no estás en producción
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors'); // Importa el paquete CORS

const app = express();

// --- INICIALIZACIÓN DE VARIABLES DE ENTORNO GLOBALES (TU CÓDIGO ORIGINAL QUE FUNCIONA) ---
const GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64, process.env.ENCODING_TYPE || 'utf8').toString('utf8')
);
const GOOGLE_SHEET_ID_DATOS = process.env.GOOGLE_SHEET_ID_DATOS;
const GOOGLE_SHEET_NAME_DATOS = process.env.GOOGLE_SHEET_NAME_DATOS || 'Hoja1';

// --- Configuración de CORS ---
// Define los orígenes permitidos para las solicitudes CORS.
// Es crucial que el dominio de origen (Origin) sea exactamente el de tu frontend.
const allowedOrigins = [
  'https://my-sheets-frontend.onrender.com', // Frontend de Render (HTTPS)
  'http://localhost:5000',
  'http://localhost:3000',
  'https://capacitacion-dirisle.googlesites.cloud', // Tu dominio personalizado
  'https://www.capacitacion-dirisle.googlesites.cloud', // Tu dominio personalizado con www
  'https://prueba.googlesites.cloud', // Otro dominio personalizado
  'https://luiscarrillo7.github.io' // Tu frontend de GitHub Pages (HTTPS)
];

app.use(cors({
  origin: function (origin, callback) {
    // Permite solicitudes sin origen (como de Postman o curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'La política CORS para este sitio no permite el acceso desde el origen especificado.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // Importante para cookies, encabezados de autorización, etc.
  optionsSuccessStatus: 200 // Para navegadores antiguos
}));
// --- Fin de Configuración de CORS ---

// Middleware para parsear JSON en las solicitudes
app.use(express.json());

// Función para obtener el cliente de autenticación de Google
async function getAuthClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: GOOGLE_SERVICE_ACCOUNT_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return await auth.getClient();
}

app.post('/api/check-user', async (req, res) => {
    const { valor } = req.body;

    // --- CÓDIGO AÑADIDO/MODIFICADO PARA CAPTURAR INFORMACIÓN DE LA SOLICITUD ---
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referer = req.headers['referer'] || 'N/A'; // De dónde vino la solicitud (URL del frontend)

    console.log('Backend: =========================================');
    console.log(`Backend: Nueva solicitud recibida.`);
    console.log(`Backend: IP del cliente: ${clientIp}`);
    console.log(`Backend: User-Agent (SO/Dispositivo): ${userAgent}`);
    console.log(`Backend: Referer (Origen de la solicitud): ${referer}`);
    console.log(`Backend: Valor enviado en el cuerpo de la solicitud (desde frontend): "${valor}" (Longitud: ${valor.length})`);
    console.log('Backend: =========================================');
    // --- FIN DEL CÓDIGO AÑADIDO/MODIFICADO ---

    if (!valor) {
        console.log('Backend: Valor vacío. Devolviendo error 400.');
        return res.status(400).json({ message: 'El campo "valor" es requerido.' });
    }

    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        // Validar que las variables de entorno globales existan antes de usarlas
        if (!GOOGLE_SHEET_ID_DATOS) {
            console.error('Backend: GOOGLE_SHEET_ID_DATOS no está configurada.');
            return res.status(500).json({ message: 'Error de configuración: ID de hoja no especificado.' });
        }

        const responseDatos = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID_DATOS,
            range: `${GOOGLE_SHEET_NAME_DATOS}!A:N`, // Rango de A a N para capturar todas las columnas necesarias
        });

        const rows = responseDatos.data.values;
        console.log('Backend: Datos leídos de la hoja de cálculo (incluyendo encabezados):', rows);

        if (rows && rows.length > 0) {
            const dataRows = rows.slice(1); // Ignorar la primera fila (encabezados)

            // --- INICIO CÓDIGO DE DEPURACIÓN DE BÚSQUEDA ---
            console.log(`Backend: Buscando "${valor}" en la columna E (índice 4) de ${dataRows.length} filas.`);
            dataRows.forEach((row, index) => {
                const columnEValue = (row[4] || '').trim();
                const isMatch = columnEValue === valor.trim();
                console.log(`Backend: Fila ${index + 2} (Hoja): Columna E = "${columnEValue}" (Longitud: ${columnEValue.length}), Coincide: ${isMatch}`);
            });
            // --- FIN CÓDIGO DE DEPURACIÓN DE BÚSQUEDA ---

            // Asumiendo que el DNI/ID está en la columna E (índice 4)
            const foundUser = dataRows.find(row => (row[4] || '').trim() === valor.trim());

            if (foundUser) {
                console.log('Backend: Usuario encontrado en la hoja de cálculo:', foundUser);

                // Ajusta los índices de columna según la posición real en tu hoja
                const idUsuario = foundUser[4] || ''; // Columna E (DNI/ID)
                const nombre = foundUser[2] || ''; // Columna C (Nombre)
                const cargo = foundUser[3] || ''; // Columna D (Cargo)
                const eess = foundUser[5] || ''; // Columna F (EESS)
                const ris = foundUser[6] || ''; // Columna G (RIS)
                const horas = foundUser[12] || ''; // Columna M (Horas)
                const puntaje = foundUser[13] || ''; // Columna N (Puntaje)

                return res.json({
                    exists: true,
                    message: 'Usuario existe.',
                    idUsuario,
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
        // Detalles adicionales del error para depuración
        let errorMessage = 'Error interno del servidor al verificar el usuario.';
        // Si el error es por credenciales, podemos dar un mensaje más específico
        if (error.message.includes('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64') || error.message.includes('parsear las credenciales')) {
            errorMessage = `Error de configuración de credenciales: ${error.message}. Asegúrate de que GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_BASE64 sea un JSON Base64 válido.`;
        } else if (error.code) {
            errorMessage += ` Código de error: ${error.code}.`;
        }
        if (error.errors && error.errors.length > 0) {
            errorMessage += ` Detalles: ${error.errors[0].message}.`;
        }
        return res.status(500).json({ message: errorMessage });
    }
});

app.get('/', (req, res) => {
    res.send('¡Backend funcionando! Usa el endpoint /api/check-user para verificar usuarios.');
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor backend escuchando en http://0.0.0.0:${port}`);
});
