"use client";

import { useState, useEffect } from "react";
import Web3 from "web3";
import "bootstrap/dist/css/bootstrap.min.css";

const CHAIN_ID = 11155111;

export default function Home() {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState(null);
  const [abi, setAbi] = useState(null);
  const [contractAddress, setContractAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [balance, setBalance] = useState("0");
  const [decimals, setDecimals] = useState(18);
  const [owner, setOwner] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [status, setStatus] = useState("");
  const [hasProvider, setHasProvider] = useState(false); // <-- guard for window.ethereum

  // Проверка наличия провайдера (делаем в useEffect — выполняется только на клиенте)
  useEffect(() => {
    setHasProvider(typeof window !== "undefined" && Boolean(window.ethereum));
  }, []);

  // Загрузка ABI и адреса контракта из JSON
  useEffect(() => {
    fetch("/Token.json")
      .then(res => res.json())
      .then(json => {
        setAbi(json.abi);
        const networks = json.networks || {};
        const key = Object.keys(networks).find(
          (k) => Number(k) === CHAIN_ID || k === String(CHAIN_ID)
        );
        if (key && networks[key].address) {
          setContractAddress(networks[key].address);
        } else if (json.networks && json.networks[CHAIN_ID] && json.networks[CHAIN_ID].address) {
          setContractAddress(json.networks[CHAIN_ID].address);
        } else {
          console.warn("Contract address not found in Token.json for chain", CHAIN_ID);
        }
      })
      .catch(err => console.error("Failed to load Token.json:", err));
  }, []);

  // Инициализация web3 и контракта после загрузки ABI и адреса
  useEffect(() => {
    if (web3 && abi && contractAddress) {
      const tokenContract = new web3.eth.Contract(abi, contractAddress);
      setContract(tokenContract);

      tokenContract.methods.decimals().call().then(setDecimals).catch(() => setDecimals(18));
      tokenContract.methods.owner().call().then(setOwner).catch(() => setOwner(""));
    }
  }, [web3, abi, contractAddress]);

  // Подключение кошелька
  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) return alert("Install MetaMask!");
    try {
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      fetchBalance(accounts[0], web3Instance);
    } catch (err) {
      console.error(err);
    }
  };

  // Получение баланса токенов
  const fetchBalance = async (addr = account, web3Instance = web3) => {
    if (!contract || !web3Instance || !addr) return;
    try {
      const bal = await contract.methods.balanceOf(addr).call();
      // корректное отображение с учётом decimals
      const adjusted = (BigInt(bal).toString() === "0")
        ? "0"
        : (Number(bal) / (10 ** decimals)).toLocaleString(undefined, { maximumFractionDigits: decimals });
      setBalance(adjusted);
    } catch (err) {
      console.error("fetchBalance error", err);
    }
  };

  // Перевод токенов
  const handleTransfer = async () => {
    if (!contract || !account) return;
    try {
      setStatus("Sending tokens...");
      const amountToSend = (transferAmount * (10 ** decimals)).toString();
      await contract.methods.transfer(transferTo, amountToSend).send({ from: account });
      setStatus("Transfer successful!");
      fetchBalance(account);
    } catch (err) {
      console.error(err);
      setStatus("Transfer failed!");
    }
  };

  // Чеканка токенов (только для владельца)
  const handleMint = async () => {
    if (!contract || !account || account.toLowerCase() !== owner.toLowerCase()) return;
    try {
      setStatus("Minting tokens...");
      const amountToMint = (mintAmount * (10 ** decimals)).toString();
      await contract.methods.mint(mintTo, amountToMint).send({ from: account });
      setStatus("Mint successful!");
      fetchBalance(mintTo);
    } catch (err) {
      console.error(err);
      setStatus("Mint failed!");
    }
  };

  // Добавление токена в MetaMask через EIP-747
  const handleAddToken = async () => {
    if (typeof window === "undefined" || !window.ethereum) return alert("No wallet provider found");
    try {
      await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: contractAddress,
            symbol: "TKN",
            decimals: decimals,
            image: "https://via.placeholder.com/32",
          },
        },
      });
    } catch (err) {
      console.error("Failed to add token:", err);
    }
  };

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3">Token dApp</h1>
        <div>
          {!account ? (
            <button className="btn btn-primary" onClick={connectWallet} disabled={!hasProvider}>
              {hasProvider ? "Connect Wallet" : "No Wallet"}
            </button>
          ) : (
            <div className="text-end">
              <div className="small text-muted">Connected</div>
              <div className="fw-bold">{account}</div>
            </div>
          )}
        </div>
      </div>

      <div className="row gy-4">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Account</h5>
              <p className="mb-1"><span className="text-muted">Address</span></p>
              <p className="fw-monospace small">{account || "Not connected"}</p>

              <p className="mb-1"><span className="text-muted">Token contract</span></p>
              <p className="fw-monospace small">{contractAddress || "Not loaded"}</p>

              <hr />

              <p className="mb-1"><span className="text-muted">Balance</span></p>
              <h3 className="display-6">{balance} <small className="text-muted">tokens</small></h3>

              <p className="mt-3 mb-0"><span className="text-muted">Decimals</span>: {decimals}</p>
              <p className="mb-0"><span className="text-muted">Owner</span>: {owner || "—"}</p>

              <div className="mt-3">
                <button
                  className="btn btn-outline-secondary me-2"
                  onClick={() => fetchBalance(account)}
                  disabled={!account || !contract}
                >
                  Refresh
                </button>
                <button
                  className="btn btn-outline-success"
                  onClick={handleAddToken}
                  disabled={!hasProvider || !contractAddress}
                >
                  Add token to wallet
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <h5 className="card-title">Transfer Tokens</h5>
              <div className="mb-3">
                <label className="form-label">Recipient address</label>
                <input
                  className="form-control form-control-sm"
                  type="text"
                  placeholder="0x..."
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Amount (display units)</label>
                <input
                  className="form-control form-control-sm"
                  type="number"
                  step="any"
                  placeholder={`e.g. 1.5  (decimals: ${decimals})`}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </div>
              <div className="d-flex">
                <button
                  className="btn btn-primary me-2"
                  onClick={handleTransfer}
                  disabled={!account || !contract || !transferTo || !transferAmount}
                >
                  Send
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => { setTransferTo(""); setTransferAmount(""); }}
                >
                  Clear
                </button>
              </div>

              {status && (
                <div className="mt-3">
                  <div className="alert alert-info py-2">{status}</div>
                </div>
              )}
            </div>
          </div>

          {account && owner && account.toLowerCase() === owner.toLowerCase() && (
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Mint Tokens (Owner)</h5>
                <div className="mb-3">
                  <label className="form-label">Recipient address</label>
                  <input
                    className="form-control form-control-sm"
                    type="text"
                    placeholder="0x..."
                    value={mintTo}
                    onChange={(e) => setMintTo(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Amount (display units)</label>
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    step="any"
                    placeholder={`e.g. 100 (decimals: ${decimals})`}
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                  />
                </div>
                <div className="d-flex">
                  <button
                    className="btn btn-success me-2"
                    onClick={handleMint}
                    disabled={!mintTo || !mintAmount}
                  >
                    Mint
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => { setMintTo(""); setMintAmount(""); }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="text-center mt-5 text-muted small">
        Tip: decimals are handled when sending / minting — enter human-readable amounts (e.g. 1.5)
      </footer>
    </div>
  );
}

