import { Options } from '@mikro-orm/core'
import { Post } from './entities/post.entity'
import { __prod__ } from './constants'
import path from 'path'
import { User } from './entities/User.entity'

const config: Options = {
  migrations: {
    path: path.join(__dirname, './migrations'),
    pattern: /^[\w-]+\d+\.[tj]s$/,
  },
  entities: [Post, User],
  dbName: 'lireddit',
  type: 'postgresql',
  debug: !__prod__,
  password: 'ngocbao',
}
export default config
