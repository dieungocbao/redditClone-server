import { MyContext } from '../types'
import {
  Resolver,
  Ctx,
  Arg,
  Mutation,
  InputType,
  Field,
  ObjectType,
} from 'type-graphql'
import { User } from '../entities/user.entity'
import argon2 from 'argon2'

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string
  @Field()
  password: string
}

@ObjectType()
class FieldError {
  @Field()
  field: string
  @Field()
  message: string
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[]

  @Field(() => User, { nullable: true })
  user?: User
}

@Resolver()
export class UserResolver {
  @Mutation(() => UserResponse)
  async register(
    @Arg('input') input: UsernamePasswordInput,
    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    if (input?.username.length < 6) {
      return {
        errors: [
          {
            field: 'username',
            message: 'username length must be greater then 6',
          },
        ],
      }
    }
    if (input?.password.length < 6) {
      return {
        errors: [
          {
            field: 'password',
            message: 'password length must be greater then 6',
          },
        ],
      }
    }

    const hashedPassword = await argon2.hash(input.password)
    const user = em.create(User, {
      username: input.username,
      password: hashedPassword,
    })

    try {
      await em.persistAndFlush(user)
    } catch (err) {
      if (err.code === '23505') {
        return {
          errors: [
            {
              field: 'username',
              message: 'username already taken',
            },
          ],
        }
      }
    }
    return { user }
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('input') input: UsernamePasswordInput,
    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, {
      username: input.username.toLowerCase(),
    })
    if (!user) {
      return {
        errors: [
          {
            field: 'username',
            message: "That user doesn't exist",
          },
        ],
      }
    }
    const validPassword = await argon2.verify(user.password, input.password)
    if (!validPassword) {
      return {
        errors: [
          {
            field: 'password',
            message: 'incorrect password',
          },
        ],
      }
    }
    return { user }
  }
}
