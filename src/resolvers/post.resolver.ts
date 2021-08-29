import { Post } from '../entities/post.entity'
import {
  Resolver,
  Query,
  Arg,
  Int,
  Mutation,
  Ctx,
  Authorized,
  FieldResolver,
  Root,
} from 'type-graphql'
import { PostInput } from '../dto/postInput.dto'
import { MyContext } from '../types'
import { getConnection } from 'typeorm'

@Resolver((of) => Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 150) + '...'
  }

  @Query(() => [Post])
  posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
  ): Promise<Post[]> {
    const realLimit = Math.min(limit, 50)
    const qb = getConnection().getRepository(Post).createQueryBuilder('p')
    if (cursor) {
      qb.where('"createdAt" > :cursor', { cursor: new Date(parseInt(cursor)) })
    }
    return qb.orderBy('"createdAt"', 'DESC').take(realLimit).getMany()
  }

  @Query(() => Post, { nullable: true })
  post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne({ _id: id })
  }

  @Authorized()
  @Mutation(() => Post)
  async createPost(
    @Arg('input') input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    // 2 sql queries
    return Post.create({ ...input, creatorId: +req.session.userId }).save()
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title') title: string
  ): Promise<Post | null> {
    const post = await Post.findOne({ _id: id })
    if (!post) {
      return null
    }
    if (typeof title !== 'undefined') {
      await Post.update({ _id: id }, { title })
    }
    return post
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg('id', () => Int) id: number): Promise<Boolean> {
    try {
      await Post.delete({ _id: id })
      return true
    } catch {
      return false
    }
  }
}
