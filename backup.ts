import * as aws from '@pulumi/aws';
// import * as pulumi from '@pulumi/pulumi';

const SIZE = 't2.large';
// const ami = aws.getAmiOutput({
//   filters: [
//     {
//       name: 'name',
//       values: ['amzn-ami-hvm-*'],
//     },
//   ],
//   owners: ['137112412989'], // This owner ID is Amazon
//   mostRecent: true,
// });

const group = new aws.ec2.SecurityGroup('satisfactory-secgrp', {
  ingress: [
    { protocol: 'tcp', fromPort: 7777, toPort: 7777, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 15000, toPort: 15000, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 15777, toPort: 15777, cidrBlocks: ['0.0.0.0/0'] },
  ],
});

const instance = new aws.ec2.Instance('satisfactory-instance', {
  instanceType: SIZE,
  vpcSecurityGroupIds: [group.id], // reference the security group resource above
  ami: ami.id,
});

const eip = new aws.ec2.Eip('satisfactory-eip', {
  vpc: true,
});
new aws.ec2.EipAssociation('eipAssoc', {
  instanceId: instance.id,
  allocationId: eip.id,
});

export const { publicIp } = instance;
export const publicHostName = instance.publicDns;
