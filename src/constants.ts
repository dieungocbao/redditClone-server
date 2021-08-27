import { config } from "dotenv"

// env config
config()

export const PORT = process.env.PORT
export const DB_NAME = process.env.DB_NAME
export const DB_USER = process.env.DB_USER
export const DB_PASSWORD = process.env.DB_PASSWORD
export const FE_URL = process.env.FE_URL

export const __prod__ = process.env.NODE_ENV === "production"
export const COOKIE_NAME = "qid"
export const COOKIE_SECRET_KEY = process.env.COOKIE_SECRET_KEY
export const FORGET_PASSWORD_PREFIX = "forget-password:"
