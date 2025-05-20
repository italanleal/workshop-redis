import express from 'express';
import fs from 'fs';
import path from 'path';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;
const IMAGE_FOLDER = path.join('db', 'imagens');
const CACHE_KEY = 'photos:list';

// Redis client
const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

// Middleware para log simples
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Endpoint: GET /photos - retorna lista de imagens com cache
app.get('/photos', async (req, res) => {
  try {
    const cachedPhotos = await redisClient.get(CACHE_KEY);

    if (cachedPhotos) {
      console.log('Cache hit!');
      return res.json(JSON.parse(cachedPhotos));
    }

    console.log('Cache miss. Reading from filesystem...');
    const files = await fs.promises.readdir(IMAGE_FOLDER);
    const images = files.map((file, index) => ({
      id: index,
      name: file,
      url: `/photos/${index}`
    }));

    // Cache por 60 segundos (opcional)
    await redisClient.setEx(CACHE_KEY, 60, JSON.stringify(images));

    res.json(images);
  } catch (error) {
    console.error('Error listing photos:', error);
    res.status(500).json({ error: 'Erro ao listar imagens.' });
  }
});

// Endpoint: GET /photos/:id - retorna imagem específica
app.get('/photos/:id', async (req, res) => {
  try {
    const files = await fs.promises.readdir(IMAGE_FOLDER);
    const id = parseInt(req.params.id, 10);

    if (id < 0 || id >= files.length) {
      return res.status(404).json({ error: 'Imagem não encontrada.' });
    }

    const filePath = path.join(IMAGE_FOLDER, files[id]);
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error retrieving image:', error);
    res.status(500).json({ error: 'Erro ao recuperar imagem.' });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
