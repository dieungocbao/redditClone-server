import { UsernamePasswordInput } from "../dto/UsernamePasswordInput"

export const validateRegister = (input: UsernamePasswordInput) => {
  if (!input?.email.includes("@")) {
    return [
      {
        field: "email",
        message: "invalid email",
      },
    ]
  }

  if (input?.username.length < 6) {
    return [
      {
        field: "username",
        message: "username length must be greater then 6",
      },
    ]
  }

  if (input?.username.includes("@")) {
    return [
      {
        field: "username",
        message: "cannot include an @",
      },
    ]
  }

  if (input?.password.length < 6) {
    return [
      {
        field: "password",
        message: "password length must be greater then 6",
      },
    ]
  }
  return null
}
