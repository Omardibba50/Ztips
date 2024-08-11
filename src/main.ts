import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { InfoExchange } from './contracts/InfoExchange.js';
import { UserVerification, UserVerificationProof } from './zkPrograms/UserVerification.js';
import { Field, Mina, PrivateKey, PublicKey, AccountUpdate, UInt64, CircuitString } from 'o1js';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const useProof = false;

let zkAppInstance: InfoExchange | null = null;
let zkAppPrivateKey: PrivateKey | null = null;

async function initializeBlockchain() {
  const Local = await Mina.LocalBlockchain({ proofsEnabled: useProof });
  Mina.setActiveInstance(Local);
  const deployerAccount = Local.testAccounts[0];
  zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();
  zkAppInstance = new InfoExchange(zkAppAddress);

  const deployTxn = await Mina.transaction(deployerAccount.publicKey, async () => {
    AccountUpdate.fundNewAccount(deployerAccount.publicKey);
    await zkAppInstance!.deploy();
  });
  await deployTxn.sign([deployerAccount.privateKey, zkAppPrivateKey]).send();

  console.log('Blockchain initialized and contract deployed');
}

app.post('/api/register', async (req, res) => {
  try {
    const { publicKey, name, email } = req.body;
    const userData = {
      publicKey: PublicKey.fromBase58(publicKey),
      name: CircuitString.fromString(name),
      email: CircuitString.fromString(email),
    };

    const verificationHash = await UserVerification.verifyUser(userData);
    const proof = await UserVerification.prove(userData);

    // Here you would typically store the proof and verificationHash

    res.json({ success: true, verificationHash: verificationHash.toString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/create-bounty', async (req, res) => {
  try {
    const { amount, description, seekerPublicKey } = req.body;
    if (!zkAppInstance) throw new Error('ZkApp not initialized');

    const bounty = {
      id: zkAppInstance.nextBountyId.get(),
      amount: UInt64.from(amount),
      description: CircuitString.fromString(description),
      seeker: PublicKey.fromBase58(seekerPublicKey),
      provider: PublicKey.empty(),
      isCompleted: false,
    };

    const txn = await Mina.transaction(PublicKey.fromBase58(seekerPublicKey), async () => {
      await zkAppInstance!.createBounty(bounty);
    });

    await txn.prove();
    await txn.sign([zkAppPrivateKey!]).send();

    res.json({ success: true, bountyId: bounty.id.toString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/bounties', (req, res) => {
  // Mock data for demonstration
  const bounties = [
    { id: 1, name: "Missing Person Case", status: "In Progress", started: "2023-03-15", due: "2023-04-15", awards: "00" },
    { id: 2, name: "Cold Case Revival", status: "Completed", started: "2023-02-01", due: "2023-03-01", awards: "00" },
    { id: 3, name: "Cybercrime Investigation", status: "Not Started", started: "2023-04-01", due: "2023-05-01", awards: "Pending" },
  ];
  res.json(bounties);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initializeBlockchain();
  console.log(`Server running on port ${PORT}`);
});
