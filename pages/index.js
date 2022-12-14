import Head from "next/head";
import styles from "../styles/Home.module.css";
import "bulma/css/bulma.css";
import { ethers } from "ethers";
import { useState, useEffect } from "react";
import getLotteryContract from "../blockchain/lottery";

export default function Home() {
  const [signer, setSigner] = useState();

  const [lotteryContract, setLotteryContract] = useState();
  const [currentManager, setCurrentManager] = useState();
  const [lotteryPot, setLotteryPot] = useState(0);
  const [lotteryParticipants, setLotteryParticipants] = useState([]);
  const [lotteryHistory, setLotteryHistory] = useState([]);
  const [error, setError] = useState();
  const [successMessage, setSuccessMessage] = useState();
  const [currentAddress, setCurrentAddress] = useState();

  // Updating the UI values every time the contract values are changed
  useEffect(() => {
    updateState();
  }, [lotteryContract]);

  const updateState = async (winningUpdate = false) => {
    if (lotteryContract) {
      const manager = await lotteryContract.manager();
      const pot = await lotteryContract.getCollectedAmount();
      const participants = await lotteryContract.getParticipants();
      const lotteryId = await lotteryContract.lotteryId();

      for (let i = lotteryId; i > 0; i--) {
        const winnerAddress = await lotteryContract.lotteryHistory(i);
        if (winnerAddress === "0x0000000000000000000000000000000000000000")
          continue;
        // Put winning message here: if i === lotteryId here then show the winning message with winner address
        if (i === lotteryId && winningUpdate) {
          setSuccessMessage(
            `${winnerAddress} won ${lotteryPot} Ether! Congratulations 🥳`
          );
        }
        const historyObj = { key: i, address: winnerAddress };
        // Adds the history object only if it doesn't already exist
        if (
          lotteryHistory.filter((e) => e.address === winnerAddress).length === 0
        ) {
          setLotteryHistory((lotteryHistory) => [
            ...lotteryHistory,
            historyObj,
          ]);
        }
      }

      setCurrentManager(manager);
      setLotteryPot(ethers.utils.formatEther(pot.toString()));
      setLotteryParticipants(participants);
    }
  };

  // Handler for connecting wallet
  const connectWalletHandler = async () => {
    setError("");
    // Quick check to inform if the MetaMask is already connected
    const accounts = await ethereum.request({ method: "eth_accounts" });
    if (accounts.length) alert(`You are already connected to: ${accounts[0]}`);

    // Proceed to connect to MetaMask Check if MetaMask is installed
    if (typeof window !== "undefined" && typeof window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []); // Requesting the wallet connection
        const signer = provider.getSigner();
        const contract = getLotteryContract(ethers, signer);

        // Setting the global constants
        setSigner(signer);
        setLotteryContract(contract);

        setCurrentAddress(accounts[0]);
        // Listener to update the currently selected MM wallet address
        window.ethereum.on("accountsChanged", function (accounts) {
          setCurrentAddress(accounts[0]);
        });
      } catch (err) {
        console.log(err.message);
      }
    } else {
      // MetaMask is not installed
      alert("Please install MetaMask extension first!");
    }
  };

  // Handler for participating in the lottery
  const participate = async () => {
    setError("");
    try {
      const tx = await signer.sendTransaction({
        to: "0xba38610d6ceb970de9127ed0b4eb6f0a31fed8c7", // Lottery contract address
        value: ethers.utils.parseEther("0.01"),
      });
      await tx.wait();
      updateState();
    } catch (error) {
      if (error.message.search("Manager cannot participate") !== -1)
        setError("Manager cannot participate");
      else if (
        error.message.search(
          "Lottery is not yet started. Choose a manager first."
        ) !== -1
      )
        setError("Lottery is not yet started. Choose a manager first.");
      else setError(error.message);
    }
  };

  // Handler for getting results
  const getResults = async () => {
    setError("");
    try {
      setSuccessMessage("Sending transaction... Please wait");
      const tx = await lotteryContract.getResults();
      await tx.wait();

      let remainingSec = 120;
      const intervalId = window.setInterval(function () {
        setSuccessMessage(`Just ${--remainingSec}s more!`);
      }, 1000);
      setTimeout(() => {
        clearInterval(intervalId);
        updateState(true);
      }, 120_000);
    } catch (error) {
      setSuccessMessage("");
      if (error.message.search("Only manager can get the results") !== -1)
        setError("Only manager can get the results");
      else if (
        error.message.search("Lottery must have at least 3 participants") !== -1
      )
        setError("Lottery must have at least 3 participants");
      else if (
        error.message.search(
          "Lottery is not yet started. Choose a manager first."
        ) !== -1
      )
        setError("Lottery is not yet started. Choose a manager first.");
      else setError(error.message);
    }
  };
  // Handler for setting new manager
  const setNewManager = async () => {
    setError("");
    setSuccessMessage("");
    try {
      const tx = await lotteryContract.setNewManager();
      await tx.wait();
      updateState();
    } catch (error) {
      if (
        error.message.search("Cannot change manager in middle of a lottery") !==
        -1
      )
        setError("Cannot change manager in middle of a lottery");
      else setError(error.message);
    }
  };

  return (
    <div>
      <Head>
        <title>Ether Lottery</title>
        <meta name="description" content="An Ethereum Lottery dApp" />
        <link
          rel="icon"
          href={`${process.env.NEXT_PUBLIC_FAVICON}/favicon.ico`}
        />
      </Head>

      <main className={styles.main}>
        {/* Top nav */}
        <nav className="navbar mt-4 mb-4">
          <div className="container">
            <div className="navbar-brand">
              <h1>Ether Lottery</h1>
            </div>
            <div className="navbar-end">
              <button className="button is-link" onClick={connectWalletHandler}>
                Connect Wallet
              </button>
            </div>
          </div>
        </nav>

        {/* Main */}
        <div className="container">
          <section className="mt-5">
            <div className="columns">
              {/* Left side */}
              <div className="column is-two-third">
                {/* Participation */}
                <section className="mt-5">
                  <p>
                    Participate in the lottery by sending exactly 0.01 Ether
                  </p>
                  <button
                    className="button is-link is-light is-large mt-3"
                    onClick={participate}
                  >
                    Participate
                  </button>
                  <p>
                    <strong>Your address:</strong> {currentAddress}
                  </p>
                </section>
                {/* Getting results */}
                <section className="mt-6">
                  <p>
                    <strong>Manager only:</strong> Get the lottery results
                  </p>
                  <button
                    className="button is-success is-light is-large mt-3"
                    onClick={getResults}
                  >
                    Get results
                  </button>
                  <p>
                    <strong>Current manager:</strong> {currentManager}
                  </p>
                </section>
                {/* Set new manager */}
                <section className="mt-6">
                  <p>
                    <strong>Only after a lottery round:</strong> Set new manager
                  </p>
                  <button
                    className="button is-warning is-light is-large mt-3"
                    onClick={setNewManager}
                  >
                    Set new manager
                  </button>
                </section>
                {/* Error preview */}
                <section>
                  <div className="container has-text-danger mt-6">
                    <p>{error}</p>
                  </div>
                </section>
                {/* Success preview */}
                <section>
                  <div className="container has-text-success mt-6">
                    <p>{successMessage}</p>
                  </div>
                </section>
              </div>

              {/* Right side */}
              <div className={`${styles.lotteryinfo} column is-one-third`}>
                {/* Lottery history */}
                <section className="mt-5">
                  <div className="card">
                    <div className="card-content">
                      <div className="content">
                        <h2>Lottery History</h2>
                        {lotteryHistory.map((item) => {
                          return (
                            <div
                              className="history-entry mt-3"
                              key={`${item.key}-${item.address}`}
                            >
                              <div>Lottery #{item.key.toString()} winner:</div>
                              <div>
                                <a
                                  href={`https://rinkeby.etherscan.io/address/${item.address}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {item.address}
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
                {/* Participants */}
                <section className="mt-5">
                  <div className="card">
                    <div className="card-content">
                      <div className="content">
                        <h2>Participants ({lotteryParticipants.length})</h2>
                        <div>
                          <ul className="ml-0">
                            {lotteryParticipants.map((participant, index) => {
                              return (
                                <li key={`${participant}-${index}`}>
                                  <a
                                    href={`https://rinkeby.etherscan.io/address/${participant}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {participant}
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
                {/* Pot */}
                <section className="mt-5">
                  <div className="card">
                    <div className="card-content">
                      <div className="content">
                        <h2>Pot</h2>
                        <p>{lotteryPot} Ether</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Bottom footer */}
      <footer className={styles.footer}>
        <p>
          &copy; 2022 <strong>ETH Lottery</strong> a project by jeet
        </p>
      </footer>
    </div>
  );
}
