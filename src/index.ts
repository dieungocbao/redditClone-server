import 'reflect-metadata'
import express from 'express'
import { ApolloServer } from 'apollo-server-express'
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core'
import { buildSchema } from 'type-graphql'
import { PostResolver } from './resolvers/post.resolver'
import { UserResolver } from './resolvers/user.resolver'
import Redis from 'ioredis'
import session from 'express-session'
import connectRedis from 'connect-redis'
import cors from 'cors'
import * as constants from './constants'
import { MyContext } from './types'
import { createConnection } from 'typeorm'
import Logger from './configs/logger'
import morganMiddleware from './configs/morganMiddleware'
import { authChecker } from './guard/auth-checker'
import { User, Post, Updoot } from './entities'

const main = async () => {
  try {
    await createConnection({
      type: 'postgres',
      database: constants.DB_NAME,
      username: constants.DB_USER,
      password: constants.DB_PASSWORD,
      logging: true,
      synchronize: true,
      entities: [User, Post, Updoot],
    })
  } catch (error) {
    Logger.error(error)
  }

  const app = express()
  app.use(
    cors({
      origin: constants.FE_URL,
      credentials: true,
    })
  )

  app.use(morganMiddleware)

  const RedisStore = connectRedis(session)
  const redis = new Redis()

  app.use(
    session({
      name: constants.COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 3, // 3 days
        httpOnly: true,
        sameSite: 'lax', // csrf
        secure: constants.__prod__, // https only
      },
      saveUninitialized: false,
      secret: constants.COOKIE_SECRET_KEY || 'temporarykey',
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
