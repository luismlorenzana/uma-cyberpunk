const cli = require.resolve('@nestjs/cli/bin/nest.js')
process.env.AUTH_MODE = 'disabled'
process.env.PORT = '8121'
process.argv.splice(1, 1, cli, 'start', '--watch')
require(cli)
