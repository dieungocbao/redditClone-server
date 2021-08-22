import "reflect-metadata"
import express from "express"
import { ApolloServer } from "apollo-server-express"
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core"
import { buildSchema } from "type-graphql"
import { PostResolver } from "./resolvers/post.resolver"
import { UserResolver } from "./resolvers/user.resolver"
import Redis from "ioredis"
import session from "express-session"
import connectRedis from "connect-redis"
import cors from "cors"
import {
  COOKIE_NAME,
  COOKIE_SECRET_KEY,
  DB_NAME,
  DB_PASSWORD,
  DB_USER,
  FE_URL,
  __prod__,
} from "./constants"
import { MyContext } from "./types"
import { createConnection } from "typeorm"
import { Post } from "./entities/post.entity"
import { User } from "./entities/user.entity"
import Logger from "./configs/logger"
import morganMiddleware from "./configs/morganMiddleware"
import { authChecker } from "./guard/auth-checker"

const main = async () => {
  try {
    await createConnection({
      type: "postgres",
      database: DB_NAME,
      username: DB_USER,
      password: DB_PASSWORD,
      logging: true,
      synchronize: true,
      entities: [Post, User],
    })
  } catch (error) {
    Logger.error(error)
  }

  const app = express()
  app.use(
    cors({
      origin: FE_URL,
      credentials: true,
    })
  )

  app.use(morganMiddleware)

  const RedisStore = connectRedis(session)
  const redis = new Redis()

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 3, // 3 days
        httpOnly: true,
        sameSite: "lax", // csrf
        secure: __prod__, // https only
      },
      saveUninitialized: false,
      secret: COOKIE_SECRET_KEY || "temporarykey",
      resave: false,
    })
  )

  const schema = await buildSchema({
    resolvers: [PostResolver, UserResolver],
    validate: false,
    authChecker,
  })

  const apolloServer = new ApolloServer({
    schema,
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
    context: ({ req, res }): MyContext => ({ req, res, redis }),
  })
  await apolloServer.start()
  apolloServer.applyMiddleware({ app, cors: false })

  const PORT = process.env.PORT || 4000

  app.listen(PORT, () =>
    Logger.debug(`🚀 Server is starting on localhost:${process.env.PORT}`)
  )
}

main().catch((err) => console.error(err))
