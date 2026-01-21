const Message = ({ role, text }) => {
  return (
    <div className={role === "user" ? "user-msg" : "ai-msg"}>
      {text}
    </div>
  );
};

export default Message;
