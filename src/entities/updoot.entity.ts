import { Entity, BaseEntity, ManyToOne, PrimaryColumn, Column } from 'typeorm'
import { User } from './user.entity'
import { Post } from './post.entity'

@Entity()
export class Updoot extends BaseEntity {
  @Column({ type: 'int' })
  value: number

  @PrimaryColumn()
  userId: number

  @ManyToOne(() => User, (user) => user.updoots)
  user: User

  @PrimaryColumn()
  postId: number

  @ManyToOne(() => Post, (post) => post.updoots)
  post: Post
}
