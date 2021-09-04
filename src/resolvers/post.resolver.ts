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
  creator(@Root() root: Post) {
    return User.findOne({ _id: root.creatorId })
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
    let cursorIdx = 3
    if (req.session.userId) {
      replacements.push(req.session.userId)
    }
    if (cursor) {
      replacements.push(new Date(parseInt(cursor)))
      cursorIdx = replacements.length
    }
    const posts = await getConnection().query(
      `
        SELECT p.*, 
        json_build_object(
          '_id', u._id,
          'username', u.username,
          'email', u.email
        ) creator,
        ${
          req.session.userId
            ? '(SELECT value from UPDOOT WHERE "userId" = $2 AND "postId" = p._id) "voteStatus"'
            : 'null as "voteStatus"'
        }
        FROM POST p
        INNER JOIN PUBLIC.USER u on u._id = p."creatorId"
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
          [realValue, postId]
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
