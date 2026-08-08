const z=require("zod");

const text=z.string().min(1,"Min 1 char required");
const receiverId = z.string().regex(
  /^[0-9a-fA-F]{24}$/,
  "Invalid MongoDB ObjectId"
);

const infoValidator=z.object({
    text:text,
    receiverId:receiverId
    
})


module.exports=infoValidator;
