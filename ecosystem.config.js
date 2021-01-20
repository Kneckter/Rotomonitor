module.exports = {
  apps : [
  {
    name: 'RDMMonitor',
    script: 'RDMMonitor.js',
    cwd: '/home/user/RDMMonitor/',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    out_file: 'NULL'
  }
  ]
};
