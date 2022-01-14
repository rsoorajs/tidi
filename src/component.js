import { h } from "preact";
import { useRef, useEffect, useState } from "preact/hooks";
import { CSS_COLOR_NAMES, EMOJI_EXPRESSIONS } from "./utils";
import "./style.css";

/**
 * A security-check to escape html/js tags expressions
 */
String.prototype.escape = function () {
  return this.replace(/[&<>]/g, function (tag) {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        ";": "_",
        "\\\\": "_",
        "//": "_",
        "^": "_",
        "|": "_",
      }[tag] || tag
    );
  });
};

// generate a key from the incomming roomKey
const hashCode = (s) => {
  if (s == null) return "0";
  return s.split("").reduce(function (a, b) {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
};

/**
 * Just getting the username indices for each letter nd get
 * the number for the color in the array
 */
const colorIndiceFromUsr = (text) => {
  let result = -3;
  for (let i = 0; i < text.length; i++) {
    let code = text.toUpperCase().charCodeAt(i);
    if (code > 64 && code < 91) result += code - 64;
  }

  return result > 0 ? result : (Math.random() * CSS_COLOR_NAMES.length) | 0;
};

/**
 * The UsrName component... yeah... a simple a tag
 * what did you expect ?
 *
 */
const UsrName = ({ usrname, color, href, isAdmin = false }) => (
  <a
    className="tsc-usrname"
    style={{ color }}
    title={isAdmin ? "admin" : "user"}
    href={href}
  >
    {isAdmin ? "**" : null}
    {usrname} :
  </a>
);

/**
 * The Msg component... too lazy to describe it,
 * as you can see it takes 3 incomming parameters... that's all
 *
 * usrname for the username of the user
 * href for the link of the profile of the user
 * message for the content message of the user
 */
const Msg = ({ usrname, href, message, isAdmin = false }) => (
  <div className="tsc-msg">
    <UsrName
      usrname={usrname}
      href={href}
      isAdmin={isAdmin}
      color={`${CSS_COLOR_NAMES[colorIndiceFromUsr(usrname.slice(0, 4))]}`}
    />
    &nbsp; {message.escape()}
  </div>
);

/**
 * The message list component that will content the list of messages
 **/
const MsgList = ({ connection }) => {
  // For incoming messages...
  const [msgs, setMsgs] = useState([]);

  const msgsBoxRef = useRef(null);
  const msgsEndRef = useRef(null);

  const scrollToBottom = () => {
    // msgsBoxRef.hoverElement.addEventListener('mouseleave', () => {
    //     msgsEndRef.current?.scrollIntoView({ behavior: "smooth" })
    // })
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMsg = (payload) => {
    // print only the 50 last elements from the array
    setMsgs(
      msgs
        .concat({
          usrname: payload["author"] == null ? "x" : payload["author"],
          message: payload["message"],
        })
        .slice(Math.max(msgs.length - 100, 0))
    );
    setTimeout(() => {
      scrollToBottom();
    }, 150);
  };

  useEffect(() => {
    // listen to onmessage event
    conn.onmessage = (evt) => {
      console.log(evt);
      // add the new message to state
      try {
        const payload = JSON.parse(evt.data);
        if (
          payload.hasOwnProperty("author") &&
          payload.hasOwnProperty("message")
        ) {
          addMsg(payload);
        }
      } catch (err) {
        console.log("tsc-err: ", err);
      }
    };
  }, [msgs]);

  return (
    <div id="tsc-messages" ref={msgsBoxRef} className="tsc-scroll-shadows">
      {msgs.length == 0 ? (
        <div className="tsc-no-msg">
          No messages yet, be the first to post a message !
        </div>
      ) : (
        msgs.map((msg, index) => (
          <Msg
            usrname={msg.usrname}
            key={index}
            href={msg.href}
            message={msg.message}
            isAdmin={msg.isAdmin ? msg.isAdmin : false}
          />
        ))
      )}{" "}
      <div ref={msgsEndRef} />
    </div>
  );
};

// check if it's an url
const isValidHttpUrl = (string) => {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
};

// check and return the key from a twitter space link
const isTwitterSpace = (string) => {
  if (
    isValidHttpUrl(string) &&
    string.includes("twitter.com") &&
    string.includes("space")
  ) {
    return string.split("/")[string.split("/").length - 1].split("?")[0];
  }
  return "";
};

const connectRoom = (connection, roomKey, action = "subscribe") => {
  const payload = {
    action: action,
    topic: `${formatRoomKey(roomKey)}`,
  };
  connection.send(JSON.stringify(payload));
  console.log(`tsc::${action} on ${roomKey}`);
};

// global previous value of the precedent roomkey
let prevRoom = "";

// TO save a setting key/alue to the localstore
const settingUpdate = (connection, key, ev) => {
  if (ev.keyCode === 13) {
    if (ev.target.value.length > 0) {
      if (key === "roomKey")
        if (localStorage.getItem("roomKey") !== null)
          prevRoom = localStorage.getItem("roomKey");

      localStorage.setItem(key, ev.target.value);

      if (key === "roomKey") {
        if (prevRoom.length > 0)
          // We try to unsuscribe safely first
          connectRoom(connection, prevRoom, "unsubscribe");
        connectRoom(connection, ev.target.value);
      }
    }
  }
};

// To format and get the key from twitter space or any other incomming key
const formatRoomKey = (roomKey) => {
  return hashCode(
    isTwitterSpace(roomKey).length > 0 ? isTwitterSpace(roomKey) : roomKey
  );
};

const SettingBoard = ({ connection, usr = "" }) => {
  const [roomKey, setRoomKey] = useState(localStorage.getItem("roomKey"));
  const [usrIn, setUsrIn] = useState(
    usr.length > 0 ? usr : localStorage.getItem("usrIn")
  );

  localStorage.setItem("usrIn", usrIn);

  return (
    <div id="tsc-setting-box">
      <h2>tidi-settings</h2>
      <hr />
      <b>{formatRoomKey(roomKey)}</b>|<b>{usrIn}</b>
      <hr />
      <input
        type="text"
        className="tsc-setting-input"
        placeholder="Your roomKey and press ENTER"
        onChange={(e) => setRoomKey(e.target.value)}
        onKeyUp={(e) => settingUpdate(connection, "roomKey", e)}
        value={roomKey}
      />
      {usr.length == 0 ? (
        <input
          className="tsc-setting-input"
          type="text"
          onChange={(e) => setUsrIn(e.target.value)}
          onKeyUp={(e) => settingUpdate(connection, "usrIn", e)}
          placeholder="Your username and press ENTER"
          value={usr}
        />
      ) : null}
      <br />
      <button
        className="tsc-setting-connect"
        onClick={() => connectRoom(connection, roomKey)}
      >
        CONNECT TO THE ROOM
      </button>
      <br />
      <div className="tsc-foot">
        by <a href="https://twitter.com/sanixdarker">@sanixdarker</a>
      </div>
      <hr />
    </div>
  );
};

/**
 * The Feed for the list of incomming messages
 **/
const Board = ({ connection, usr = "", isSettingsActive = false }) => {
  return (
    <>
      <div style={{ display: `${isSettingsActive ? "block" : "none"}` }}>
        <SettingBoard connection={connection} usr={usr} />
      </div>
      <div style={{ display: `${!isSettingsActive ? "block" : "none"}` }}>
        <MsgList connection={connection} />
      </div>
    </>
  );
};

// TO prevent an user to print the same message multipletime
let LAST_MESSAGE = "";
let LAST_MESSAGE_TIME_SENT = Date.now();
let DEFAULT_HOST = "ws://127.0.0.1:1324";
let conn = new WebSocket(`${DEFAULT_HOST}/socket`);

/**
 * THe output of the whole component
 */
export default function App(props) {
  // For the visibility of the component
  const [isActive, setActive] = useState(true); // default should be false
  // for the settings board
  const [isSettingsActive, setSettingsActive] = useState(false); // default should be false

  // For the message am writing...
  const [txtMessage, setTxtMessage] = useState("");
  // A ref for the input text
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
  }, [txtMessage]);

  const checkAndSendTxtMessage = (ev) => {
    if (ev.keyCode === 13) {
      if (ev.target.value.length > 0) {
        const msgg = ev.target.value;
        if (msgg.length > 0) {
          // if it's past 10s you can send the same message or if
          // your new message is different from the precedent
          if (
            LAST_MESSAGE != msgg ||
            Date.now() - LAST_MESSAGE_TIME_SENT > 10000
          ) {
            LAST_MESSAGE = msgg;
            LAST_MESSAGE_TIME_SENT = Date.now();
            const msgpayload = {
              author: localStorage.getItem("usrIn"),
              message: msgg,
            };
            const payload = {
              action: "publish",
              topic: `${formatRoomKey(localStorage.getItem("roomKey"))}`,
              message: JSON.stringify(msgpayload),
            };
            setTimeout(() => {
              conn.send(JSON.stringify(payload));
            }, 300);
          }
          setTxtMessage("");
        }
      }
    }
  };

  /**
   * The maggic toggle button simple as it
   */
  const ToggleButton = () => (
    <button
      onClick={() => setActive(!isActive)}
      className={`tsc-toggle-button ${!isActive ? "tsc-hide-button" : ""}`}
    >
      {isActive ? "HIDE" : "SHOW"} TIDI BOX
    </button>
  );

  /**
   * The EmojiBox for the list of all basic emojis we will have
   */
  const EmojiBox = () => (
    <div className="tsc-emojibox">
      {EMOJI_EXPRESSIONS.map((e, index) => (
        <button key={index} onClick={() => setTxtMessage(`${txtMessage}${e}`)}>
          {e}
        </button>
      ))}
    </div>
  );

  /**
   * This TextBox is the component for handling the input text of users
   * like the message w or /w emojis
   **/
  const TextBox = () => {
    return (
      <div>
        <input
          type="text"
          maxlength="130"
          onChange={(e) => setTxtMessage(e.target.value)}
          onKeyUp={(e) => checkAndSendTxtMessage(e)}
          value={txtMessage}
          autoComplete="off"
          autoFocus
          ref={inputRef}
          placeholder="Enter your message here..."
          id="tsc-text-box"
        />
      </div>
    );
  };

  return (
    <div id="tsc-ttspch-box">
      <div className={`${isActive ? "tsc-hide" : "tsc-show"}`}>
        <Board
          connection={conn}
          isSettingsActive={isSettingsActive}
          usr="darker"
        />
        {!isSettingsActive ? (
          <div>
            <EmojiBox />
            <TextBox />
          </div>
        ) : null}
      </div>
      <ToggleButton />
      {isActive ? (
        <button onClick={() => setSettingsActive(!isSettingsActive)}>⚙️</button>
      ) : null}
    </div>
  );
}
