import { Post } from "../entities/post.entity"
import { Resolver, Query, Arg, Int, Mutation } from "type-graphql"

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

  @Mutation(() => Post)
  async createPost(@Arg("title") title: string): Promise<Post> {
    // 2 sql queries
    return Post.create({ title }).save()
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
