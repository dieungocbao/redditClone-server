import { MyContext } from "../types"
import {
  Resolver,
  Ctx,
  Arg,
  Mutation,
  Field,
  ObjectType,
  Query,
} from "type-graphql"
import { User } from "../entities/user.entity"
import argon2 from "argon2"
import { EntityManager } from "@mikro-orm/postgresql"
import { COOKIE_NAME } from "../constants"
import { UsernamePasswordInput } from "../dto/UsernamePasswordInput"
import { validateRegister } from "../utils/validateRegister"

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
  @Query(() => User, { nullable: true })
  async me(@Ctx() { req, em }: MyContext) {
    if (!req.session.userId) {
      return null
    }
    const user = await em.findOne(User, { _id: +req.session.userId })
    return user
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("input") input: UsernamePasswordInput,
    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(input)
    if (errors) {
      return { errors }
    }

    const hashedPassword = await argon2.hash(input.password)

    let user

    try {
      const result = await (em as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username: input.username,
          password: hashedPassword,
          email: input.email,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning("*")
      user = result[0]
    } catch (err) {
      if (err.code === "23505") {
        return {
          errors: [
            {
              field: "username",
              message: "username already taken",
            },
          ],
        }
      }
    }
    return { user }
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(
      User,
      usernameOrEmail.includes("@")
        ? {
            email: usernameOrEmail.toLowerCase(),
          }
        : {
            username: usernameOrEmail.toLowerCase(),
          }
    )
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
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
            field: "password",
            message: "incorrect password",
          },
        ],
      }
    }

    req.session.userId = user._id
    return { user }
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) => {
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME)
        if (err) {
          console.log(err)
          resolve(false)
          return
        }
        resolve(true)
      })
    })
  }

  @Mutation(() => Boolean)
  async forgotpassword(
    @Arg("email") email: string,
    @Ctx() { req }: MyContext
  ) {}
}
