import { expect } from "chai";
import { ethers } from "hardhat";

describe("DetrixMerchantRegistry", () => {
  it("registers and updates merchant payout information", async () => {
    const [admin, merchantWallet] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("DetrixMerchantRegistry");
    const contract = await factory.deploy(admin.address);
    const merchantId = ethers.id("merchant-1");
    const metadataHash = ethers.id("merchant-meta");

    await contract.registerMerchant(merchantId, merchantWallet.address, metadataHash);
    const registered = await contract.getMerchant(merchantId);
    expect(registered.payoutAddress).to.equal(merchantWallet.address);

    await contract.setMerchantStatus(merchantId, 2);
    const updated = await contract.getMerchant(merchantId);
    expect(updated.status).to.equal(2);
  });
});

