require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Redirigir rutas con .html a sus equivalentes sin extensión
app.get(/^\/(.+)\.html$/, (req, res) => {
  const cleanPath = '/' + req.params[0];
  res.redirect(cleanPath);
});


//Conexión a Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

//Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`:3 Servidor escuchando en http://localhost:${port}`);
});

//todas las rutas de esa caga

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bienvenida.html'));
});

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/usuario', (req, res) => res.sendFile(path.join(__dirname, 'public', 'usuario.html')));
app.get('/blog', (req, res) => res.sendFile(path.join(__dirname, 'public', 'blog.html')));
app.get('/calendario', (req, res) => res.sendFile(path.join(__dirname, 'public', 'calendario.html')));
app.get('/asistente', (req, res) => res.sendFile(path.join(__dirname, 'public', 'asistente.html')));


//usuarios
app.get('/tipsview', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tips.html'));
});

//administrador
app.get('/admintips', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tipsadmin.html'));
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));


//por aca revisa quien va a iniciar sesion

// Registro de usuarios
app.post('/registrar', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'El nombre de usuario, la contraseña y el correo electrónico son requeridos' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { error } = await supabase
      .from('usuarios')
      .insert([{ username, email, password: hashedPassword }]);

    if (error) {
      console.error('Error al registrar usuario:', error);
      return res.status(500).json({ error: 'Error al registrar usuario' });
    }

    res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Login de usuarios
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'El correo y la contraseña son requeridos' });
    }

    //Verificación del administrador
    //ACA ABAJO ESTA EL CORREO Y LA CONTRA DE ADMINISTRADOR PARA Q ENTREN
    if (email === 'admin@miapp.com' && password === 'admin123') {
      const token = jwt.sign(
        { role: 'admin', username: 'Administrador', email },
        process.env.JWT_SECRET || 'secreto',
        { expiresIn: '2h' }
      );

      return res.json({
        message: 'Entrando en modo Administrador',
        token,
        user: { username: 'Administrador', email },
        role: 'admin'
      });
    }

    //SI ES UN USUARIO NORMAL ENTRA EN USUARIOS
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'secreto',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: { username: user.username, email: user.email },
      role: 'usuario'
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


//gemini rutas
app.post("/asistente", async (req, res) => {
  try {
    const { mensaje } = req.body;
    if (!mensaje) return res.status(400).json({ error: "Falta el mensaje del usuario" });

    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
    const result = await model.generateContent(mensaje);
    const respuesta = result.response.text();

    res.json({ respuesta });
  } catch (error) {
    console.error("Error al comunicarse con Gemini:", error);
    res.status(500).json({ error: "Error al generar la respuesta del asistente" });
  }
});


//tips rutas

// Obtener todos los tips (para usuarios y admin)
app.get('/api/tips', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener los tips:', error);
      return res.status(500).json({ error: 'Error al obtener los tips' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en /api/tips:', error);
    res.status(500).json({ error: 'Error del servidor al obtener tips' });
  }
});

// Agregar un nuevo tip (solo admin)
app.post('/api/tips', async (req, res) => {
  try {
    const { titulo, descripcion, imagen } = req.body;

    if (!titulo || !descripcion || !imagen) {
      return res.status(400).json({ error: 'Faltan datos: título, descripción o imagen' });
    }

    const { error } = await supabase
      .from('tips')
      .insert([{ titulo, descripcion, imagen }]);

    if (error) {
      console.error('Error al guardar el tip:', error);
      return res.status(500).json({ error: 'Error al guardar el tip' });
    }

    res.json({ message: '✅ Tip agregado correctamente' });
  } catch (error) {
    console.error('Error en /api/tips (POST):', error);
    res.status(500).json({ error: 'Error del servidor al guardar tip' });
  }
});

// Eliminar un tip (solo admin)
app.delete('/api/tips/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('tips').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: '🗑️ Tip eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar tip:', error);
    res.status(500).json({ error: 'Error al eliminar tip' });
  }
});

//rutas de comentarios

//Obtener todos los comentarios y respuestas
app.get("/api/comentarios", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("comentarios")
      .select("*")
      .order("fecha", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error al obtener comentarios:", err);
    res.status(500).json({ error: "Error al obtener los comentarios" });
  }
});

//Agregar comentarios
app.post("/api/comentarios", async (req, res) => {
  try {
    const { autor, iniciales, texto, padre_id = null } = req.body;

    if (!autor || !texto) {
      return res.status(400).json({ error: "Faltan datos obligatorios: autor o texto" });
    }

    const { data, error } = await supabase
      .from("comentarios")
      .insert([{ autor, iniciales, texto, padre_id }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    console.error("Error al agregar comentario:", err);
    res.status(500).json({ error: "Error al agregar el comentario" });
  }
});

//likes de un comentario (no me sirve, toca ver eso)
app.post("/api/comentarios/:id/like", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase.rpc("incrementar_likes", { comment_id: id });
    if (error) throw error;

    res.json({ message: "Like agregado", likes: data });
  } catch (err) {
    console.error("Error al dar like:", err);
    res.status(500).json({ error: "Error al actualizar likes" });
  }
});

//eliminar comentario
app.delete("/api/comentarios/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminar comentarios hijos primero
    await supabase.from("comentarios").delete().eq("padre_id", id);

    // Luego el comentario principal
    const { error } = await supabase.from("comentarios").delete().eq("id", id);
    if (error) throw error;

    res.json({ message: "Comentario eliminado correctamente" });
  } catch (err) {
    console.error("Error al eliminar comentario:", err);
    res.status(500).json({ error: "Error al eliminar comentario" });
  }
});



//RUTAS DE CALENDARIO MENSTRUAL

// Obtener el historial de una usuaria
app.get('/api/calendario/:usuario', async (req, res) => {
  try {
    const { usuario } = req.params;

    // Buscar ID de usuaria por username o email
    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', usuario)
      .single();

    if (userError || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { data, error } = await supabase
      .from('calendario')
      .select('*')
      .eq('usuario_id', user.id)
      .order('fecha', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error al obtener calendario:', error);
    res.status(500).json({ error: 'Error al obtener calendario' });
  }
});

// Guardar o actualizar una fecha (periodo o síntomas)
app.post('/api/calendario', async (req, res) => {
  try {
    const { usuario, fecha, tipo, sintomas = [] } = req.body;

    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', usuario)
      .single();

    if (userError || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Verificar si ya existe ese día
    const { data: existing } = await supabase
      .from('calendario')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('fecha', fecha)
      .single();

    let response;
    if (existing) {
      // Actualizar
      const { data, error } = await supabase
        .from('calendario')
        .update({ tipo, sintomas })
        .eq('id', existing.id)
        .select();
      if (error) throw error;
      response = data[0];
    } else {
      // Insertar nuevo
      const { data, error } = await supabase
        .from('calendario')
        .insert([{ usuario_id: user.id, fecha, tipo, sintomas }])
        .select();
      if (error) throw error;
      response = data[0];
    }

    res.json(response);
  } catch (error) {
    console.error('Error al guardar fecha del calendario:', error);
    res.status(500).json({ error: 'Error al guardar fecha' });
  }
});

// Eliminar una fecha
app.delete('/api/calendario/:usuario/:fecha', async (req, res) => {
  try {
    const { usuario, fecha } = req.params;

    const { data: user } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', usuario)
      .single();

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { error } = await supabase
      .from('calendario')
      .delete()
      .eq('usuario_id', user.id)
      .eq('fecha', fecha);

    if (error) throw error;

    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar fecha:', error);
    res.status(500).json({ error: 'Error al eliminar fecha' });
  }
});
