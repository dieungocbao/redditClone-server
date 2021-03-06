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
  ObjectType,
  Field,
} from 'type-graphql'
import { PostInput } from '../dto/postInput.dto'
import { MyContext } from '../types'
import { getConnection } from 'typeorm'
import { User, Post, Updoot } from '../entities'

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[]
  @Field()
  hasMore: boolean
}

@Resolver((of) => Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 150) + '...'
  }

  @FieldResolver(() => User)
  creator(@Root() root: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(root.creatorId)
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { updootLoader, req }: MyContext
  ) {
    if (!req.session.userId) {
      return null
    }

    const updoot = await updootLoader.load({
      postId: post._id,
      userId: +req.session.userId,
    })

    return updoot ? updoot.value : null
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(limit, 50)
    const realLimitPlusOne = realLimit + 1
    const replacements: any[] = [realLimitPlusOne]
    let cursorIdx = 2
    if (cursor) {
      replacements.push(new Date(parseInt(cursor)))
      cursorIdx = replacements.length
    }
    const posts = await getConnection().query(
      `
        SELECT p.*
        FROM POST p
        ${cursor ? `WHERE p."createdAt" < $${cursorIdx}` : ''}
        ORDER BY p."createdAt" DESC
        LIMIT $1
      `,
      replacements
    )

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    }
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

  @Authorized()
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('_id = :_id and "creatorId" = :creatorId', {
        _id: id,
        creatorId: +req.session.userId,
      })
      .returning('*')
      .execute()
    return result.raw[0]
  }

  @Authorized()
  @Mutation(() => Boolean)
  async deletePost(
    @Arg('id', () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<Boolean> {
    try {
      const post = await Post.findOne({ _id: id })
      if (!post) {
        return false
      }
      if (post.creatorId !== +req.session.userId) {
        throw new Error('Not authorized')
      }
      await Updoot.delete({ postId: id })
      await Post.delete({ _id: id, creatorId: +req.session.userId })
      return true
    } catch {
      return false
    }
  }

  @Authorized()
  @Mutation(() => Boolean)
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ): Promise<Boolean> {
    const isUpdoot = value !== -1
    const realValue = isUpdoot ? 1 : -1
    const { userId } = req.session
    const updoot = await Updoot.findOne({ where: { postId, userId } })
    // the user has voted on the post before
    // and they are changing their vote
    if (updoot && updoot.value !== realValue) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
          UPDATE UPDOOT
          SET value = $1
          WHERE "postId" = $2 AND "userId" = $3
        `,
          [realValue, postId, userId]
        )

        await tm.query(
          `
          UPDATE POST
          SET points = points + $1
          WHERE _id = $2
        `,
          [2 * realValue, postId]
        )
      })
    } else if (!updoot) {
      // has never voted before
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
          INSERT INTO UPDOOT ("userId", "postId", value)
          VALUES ($1, $2, $3)
        `,
          [userId, postId, realValue]
        )

        await tm.query(
          `
          UPDATE POST
          SET points = points + $1
          WHERE _id = $2
      `,
          [realValue, postId]
        )
      })
    }

    return true
  }
}
