module.exports = {
  apps: [
    {
      name: "kerala-bot",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M"
    },
    {
      name: "worker",
      script: "src/index.js",
      cwd: "internal/worker",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "320M",
      env: {
        PORT: "3005"
      }
    }
  ]
};
