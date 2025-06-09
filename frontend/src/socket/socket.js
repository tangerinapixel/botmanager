// src/socket/socket.js
import { io } from "socket.io-client";

// Aqui você ajusta para o endereço correto da sua API
const socket = io("http://localhost:5001"); // ou onde seu backend está rodando

export default socket;
