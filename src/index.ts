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
import { COOKIE_NAME, __prod__ } from "./constants"
import { MyContext } from "./types"
import { createConnection } from "typeorm"
import { Post } from "./entities/post.entity"
import { User } from "./entities/user.entity"

const main = async () => {
  try {
    await createConnection({
      type: "postgres",
      database: "lireddit2",
      username: "dieungocbao",
      password: "ngocbao",
      logging: true,
      synchronize: true,
      entities: [Post, User],
    })
  } catch (error) {
    console.log(error)
  }

  const app = express()
  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  )

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
        maxAge: 1000 * 60 * 60 * 24 * 465 * 10, // 10 years
        httpOnly: true,
        sameSite: "lax", // csrf
        secure: __prod__, // https only
      },
      saveUninitialized: false,
      secret: "dieungocbao",
      resave: false,
    })
  )

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver],
      validate: false,
    }),
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
    context: ({ req, res }): MyContext => ({ req, res, redis }),
  })
  await apolloServer.start()
  apolloServer.applyMiddleware({ app, cors: false })

  app.listen(4000, () => console.log("server started on localhost:4000"))
}

main().catch((err) => console.error(err))
