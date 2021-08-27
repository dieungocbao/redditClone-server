import { AuthChecker } from "type-graphql"
import { User } from "../entities/user.entity"
import { MyContext } from "../types"

// create auth checker function
export const authChecker: AuthChecker<MyContext> = ({ context: { req } }) =>
  //   roles
  {
    //   if (roles.length === 0) {
    //     // if `@Authorized()`, check only if user exists
    //     return user !== undefined
    //   }
    // there are some roles defined now
    const userId = req.session.userId
    if (!userId) {
      // and if no user, restrict access
      return false
    }
    const user = User.findOne({ _id: +userId })
    if (!user) {
      throw Error("User not found")
    } else {
      return true
    }
    //   if (user.roles.some((role) => roles.includes(role))) {
    //     // grant access if the roles overlap
    //     return true
    //   }

    // no roles matched, restrict access
    return false
  }
