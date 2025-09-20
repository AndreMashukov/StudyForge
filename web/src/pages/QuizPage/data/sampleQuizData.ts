import { IQuizQuestion } from '../types/IQuizTypes';

export const sampleQuizData: IQuizQuestion[] = [
  {
    id: 1,
    question: "A large enterprise with multiple branch offices needs to establish secure connectivity between all locations and their AWS environment. They want a simple, cost-effective solution that allows branch offices to communicate with each other and with AWS resources. What AWS solution should they implement?",
    options: [
      "AWS Site-to-Site VPN with individual connections from each branch to a Virtual Private Gateway",
      "AWS VPN CloudHub with multiple Customer Gateways connected to a single Virtual Private Gateway",
      "AWS Direct Connect with dedicated connections from each branch office",
      "Software VPN appliances running on EC2 instances in each region"
    ],
    correct: 1,
    correctAnswer: 1,
    explanation: "AWS VPN CloudHub is specifically designed for this hub-and-spoke scenario where multiple remote sites need to connect to AWS and communicate with each other. It uses a single Virtual Private Gateway with multiple Customer Gateways, creating a cost-effective solution that enables branch-to-branch communication through AWS."
  },
  {
    id: 2,
    question: "An organization is designing a network architecture that requires connecting 15 VPCs across 3 AWS regions to their on-premises data center via AWS Direct Connect. They need the most scalable and cost-effective solution. What combination of AWS services should they use?",
    options: [
      "Direct Connect Gateway with Virtual Private Gateways attached to each VPC",
      "Direct Connect Gateway with Transit Gateways in each region",
      "Individual Direct Connect connections to each VPC",
      "Site-to-Site VPN connections with Transit Gateway attachments"
    ],
    correct: 1,
    correctAnswer: 1,
    explanation: "Direct Connect Gateway with Transit Gateways in each region provides the most scalable solution. A single Direct Connect Gateway can connect to multiple regions, and Transit Gateway can efficiently handle multiple VPC attachments within each region."
  },
  {
    id: 3,
    question: "A company has deployed a software VPN appliance on an EC2 instance to connect their on-premises network to AWS. What are the primary operational concerns they must address that would not be present with AWS Managed VPN?",
    options: [
      "Single point of failure, OS patching, and software updates management",
      "BGP routing configuration and tunnel redundancy",
      "Internet connectivity reliability and bandwidth limitations",
      "Customer Gateway device compatibility and IPsec configuration"
    ],
    correct: 0,
    correctAnswer: 0,
    explanation: "Software VPN appliances create a single point of failure since they run on individual EC2 instances, and the customer is responsible for all operating system and software updates, patching, and maintenance."
  },
  {
    id: 4,
    question: "An organization needs to provide private connectivity from their VPC to AWS services without routing traffic over the internet. They want to access both S3 and DynamoDB from their private subnets. What is the most appropriate solution?",
    options: [
      "Configure NAT Gateway for outbound internet access to AWS services",
      "Create Interface VPC Endpoints for both S3 and DynamoDB",
      "Create a Gateway VPC Endpoint for S3 and Interface VPC Endpoint for DynamoDB",
      "Create Gateway VPC Endpoints for both S3 and DynamoDB"
    ],
    correct: 3,
    correctAnswer: 3,
    explanation: "Both S3 and DynamoDB support Gateway VPC Endpoints, which provide private connectivity without requiring an internet gateway or NAT device and have no additional charges for data processing or hourly usage."
  },
  {
    id: 5,
    question: "A Solutions Architect is designing a multi-account environment where Account A owns a Direct Connect Gateway and Accounts B and C need to connect their VPCs to on-premises networks through this gateway. What is the correct approach for cross-account Direct Connect Gateway sharing?",
    options: [
      "Account A creates VPC attachments on behalf of Accounts B and C",
      "Account A shares the Direct Connect Gateway using AWS Resource Access Manager (RAM)",
      "Accounts B and C send association proposals to Account A, who accepts and manages routing",
      "Accounts B and C must create their own Direct Connect Gateways and peer them with Account A"
    ],
    correct: 2,
    correctAnswer: 2,
    explanation: "Cross-account Direct Connect Gateway sharing works through association proposals. Accounts B and C must send association proposals to Account A (the gateway owner), who can then accept these proposals and optionally configure allowed prefixes."
  }
];