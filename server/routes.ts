import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import indexRoutes from './routes/index';
import { initializeStorage } from './services/storageService';

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize storage
  await initializeStorage();
  
  // Register all routes from index router
  app.use('/', indexRoutes);
  
  const httpServer = createServer(app);

  return httpServer;
}
