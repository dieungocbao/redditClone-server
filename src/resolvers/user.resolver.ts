import { MyContext } from '../types'
import {
  Resolver,
  Ctx,
  Arg,
  Mutation,
  Field,
  ObjectType,
  Query,
  Authorized,
  FieldResolver,
  Root,
} from 'type-graphql'
import { User } from '../entities/user.entity'
import argon2 from 'argon2'
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants'
import { UsernamePasswordInput } from '../dto/usernamePasswordInput.dto'
import { validateRegister } from '../utils/validateRegister'
import { sendEmail } from '../utils/sendEmail'
import { v4 } from 'uuid'
import Logger from '../configs/logger'

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

@Resolver((of) => User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    // only current user can see their own email
    if (req.session.userId === user._id) {
      return user.email
    }
    // current user cannot see someone else email
    return ''
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { req }: MyContext): Promise<User | null | undefined> {
    if (!req.session.userId) {
      return null
    }
    return await User.findOne({ _id: +req.session.userId })
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('input') input: UsernamePasswordInput
  ): Promise<UserResponse> {
    const errors = validateRegister(input)
    if (errors) {
      return { errors }
    }

    const hashedPassword = await argon2.hash(input.password)

    let user

    try {
      user = await User.create({
        username: input.username,
        password: hashedPassword,
        email: input.email,
      }).save()
    } catch (err) {
      Logger.error(err)
      if (err.code === '23505') {
        return {
          errors: [
            {
              field:
                err.constraint === 'user_email_unique' ? 'email' : 'username',
              message:
                err.constraint === 'user_email_unique'
                  ? 'email already taken'
                  : 'username already taken',
            },
          ],
        }
      }
    }
    return { user }
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes('@')
        ? {
            where: { email: usernameOrEmail.toLowerCase() },
          }
        : {
            where: { username: usernameOrEmail.toLowerCase() },
          }
    )
    if (!user) {
      return {
        errors: [
          {
            field: 'usernameOrEmail',
            message: "That user doesn't exist",
          },
        ],
      }
    }
    const validPassword = await argon2.verify(user.password, password)
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

    req.session.userId = user._id
    return { user }
  }

  @Authorized()
  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: MyContext): Promise<Boolean> {
    return new Promise((resolve) => {
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME)
        if (err) {
          Logger.error(err)
          resolve(false)
          return
        }
        resolve(true)
      })
    })
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg('email') email: string,
    @Ctx() { redis }: MyContext
  ): Promise<Boolean> {
    const user = await User.findOne({ where: { email } })
    if (!user) {
      // the email not in db
      return true
    }

    const token = v4()
    redis.set(FORGET_PASSWORD_PREFIX + token, user._id, 'ex', 1000 * 15) // 15 minutes expire

    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">Reset password</a>`
    )

    return true
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { redis }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length < 6) {
      return {
        errors: [
          {
            field: 'newPassword',
            message: 'length must be greater than 6',
          },
        ],
      }
    }

    const redisKeyForgetPassword = FORGET_PASSWORD_PREFIX + token

    const userId = await redis.get(redisKeyForgetPassword)
    if (!userId) {
      return {
        errors: [
          {
            field: 'token',
            message: 'token expired',
          },
        ],
      }
    }

    const user = await User.findOne({ _id: +userId })
    if (!user) {
      return {
        errors: [
          {
            field: 'token',
            message: 'user no longer exists',
          },
        ],
      }
    }

    const hashedPassword = await argon2.hash(newPassword)
    await User.update({ _id: +userId }, { password: hashedPassword })

    await redis.del(redisKeyForgetPassword)

    return { user }
  }
}
