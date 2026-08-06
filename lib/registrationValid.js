const z = require("zod");

const email = z.string().email();
const password = z.string().min(9, "Min 9 chars");
const username = z.string().min(5, "Min 5 chars");

const registrationValidation = z.object({
  email: email,
  password: password,
  username: username,
});

const loginValidation=z.object({
  email: email,
  password: password,
})

module.exports = registrationValidation;
