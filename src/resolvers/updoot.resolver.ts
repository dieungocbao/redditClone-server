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

@Resolver((of) => Updoot)
export class UpdootResolver {
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

    await getConnection().query(
      `
      START TRANSACTION;
      INSERT INTO UPDOOT("userId", "postId", "value")
      VALUES(${+userId}, ${postId}, ${realValue});
      
      UPDATE POST
      SET points = points + ${realValue}
      WHERE _id = ${postId};
      COMMIT;
    `
    )

    return true
  }
}
