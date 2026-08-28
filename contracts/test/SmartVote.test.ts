import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SmartVote", () => {
  async function deploy() {
    const [owner, other] = await ethers.getSigners();
    const SmartVote = await ethers.getContractFactory("SmartVote");
    const sv = await SmartVote.deploy();
    return { sv, owner, other };
  }

  it("crée et ouvre une élection", async () => {
    const { sv } = await deploy();
    const now = await time.latest();
    await sv.createElection("Chef de classe L3 GL", now, now + 3600);
    await sv.openElection(1);
    const e = await sv.getElection(1);
    expect(e.title).to.equal("Chef de classe L3 GL");
    expect(e.open).to.equal(true);
  });

  it("enregistre un vote unique", async () => {
    const { sv } = await deploy();
    const now = await time.latest();
    await sv.createElection("Test", now, now + 3600);
    await sv.openElection(1);

    const voteHash = ethers.keccak256(ethers.toUtf8Bytes("student1|election1|candidate1|nonce"));
    await sv.castVote(1, voteHash);
    expect(await sv.verifyVote(1, voteHash)).to.equal(true);
    expect(await sv.voteCount(1)).to.equal(1n);
  });

  it("rejette les votes en double", async () => {
    const { sv } = await deploy();
    const now = await time.latest();
    await sv.createElection("Test", now, now + 3600);
    await sv.openElection(1);
    const h = ethers.keccak256(ethers.toUtf8Bytes("vote"));
    await sv.castVote(1, h);
    await expect(sv.castVote(1, h)).to.be.revertedWith("SmartVote: vote already recorded");
  });

  it("interdit aux non-propriétaires de voter", async () => {
    const { sv, other } = await deploy();
    const now = await time.latest();
    await sv.createElection("Test", now, now + 3600);
    await sv.openElection(1);
    const h = ethers.keccak256(ethers.toUtf8Bytes("vote"));
    await expect(sv.connect(other).castVote(1, h)).to.be.revertedWith("SmartVote: not owner");
  });
});
