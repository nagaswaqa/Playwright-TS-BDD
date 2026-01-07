import { configure, getLogger } from 'log4js';

configure({
    appenders: {
        console: {
            type: 'stdout',
            layout: {
                type: 'pattern',
                pattern: '%d{yyyy-MM-dd hh:mm:ss} [%p] %m'
            }
        },
        file: {
            type: 'file',
            filename: 'logs/test-execution.log',
            maxLogSize: 10485760,
            backups: 3,
            compress: true
        }
    },
    categories: {
        default: { appenders: ['console', 'file'], level: 'info' }
    }
});

export const logger = getLogger('nextgenfeats');
