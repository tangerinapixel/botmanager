// Adicione esta configuração:
module.exports = {
  OFFLINE_CONFIG: {
    TIMEOUT_MS: 300000, // 5 minutos
    FETCH_LIMIT: 50,
    MAX_HOURS_OLD: 72 // Suporta fins de semana e feriados (até 3 dias offline)
  },
  // Suas outras configurações existentes...
};