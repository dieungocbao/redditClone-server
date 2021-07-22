import { MikroORM } from '@mikro-orm/core'
import { __prod__ } from './constants'
import microCofig from './mikro-orm.config'
import express from 'express'
import { ApolloServer } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'
import { PostResolver } from './resolvers/post.resolver'

const main = async () => {
  const orm = await MikroORM.init(microCofig)
  await orm.getMigrator().up()

  const app = express()

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver],
      validate: false,
    }),
    context: () => ({ em: orm.em }),
  })
  await apolloServer.start()
  apolloServer.applyMiddleware({ app })

  app.listen(4000, () => console.log('server started on localhost:4000'))
}

main().catch((err) => console.error(err))
