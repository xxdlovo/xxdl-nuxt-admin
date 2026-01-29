// drizzle orm db 
import 'dotenv/config';
import mysql from "mysql2/promise";
import {drizzle} from "drizzle-orm/mysql2";
import * as schema from './schema'
const config = useRuntimeConfig()
const poolConnection = mysql.createPool({
    host: config.db.host,
    user:  config.db.user,
    password: config.db.password,
    database:  config.db.database,
});

export const  db =  drizzle(poolConnection,{logger: false,mode: "default", schema});



