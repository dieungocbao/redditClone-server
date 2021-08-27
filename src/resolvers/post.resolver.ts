import { Post } from "../entities/post.entity"
import { Resolver, Query, Arg, Int, Mutation, Ctx, Authorized } from "type-graphql"
import { PostInput } from "../dto/postInput.dto"
import { MyContext } from "../types"

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  posts(): Promise<Post[]> {
    return Post.find({})
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne({ _id: id })
  }

  @Authorized()
  @Mutation(() => Post)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    // 2 sql queries
    return Post.create({ ...input, creatorId: +req.session.userId }).save()
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title") title: string
  ): Promise<Post | null> {
    const post = await Post.findOne({ _id: id })
    if (!post) {
      return null
    }
    if (typeof title !== "undefined") {
      await Post.update({ _id: id }, { title })
    }
    return post
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg("id", () => Int) id: number): Promise<Boolean> {
    try {
      await Post.delete({ _id: id })
      return true
    } catch {
      return false
    }
  }
}
